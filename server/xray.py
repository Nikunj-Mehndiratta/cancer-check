"""
Chest X-ray analysis with TorchXRayVision (research model, not a medical device).

Model: DenseNet-121 "densenet121-res224-all", trained by the TorchXRayVision
project on 8 public chest X-ray datasets (NIH, PadChest, CheXpert, MIMIC-CXR,
Google, OpenI, RSNA, Kaggle). https://github.com/mlmed/torchxrayvision

Scores are "operating-point normalised": 0.5 is the threshold the model's
authors picked for flagging each finding. A score is not a probability of
disease, and none of the labels is "cancer".
"""
from __future__ import annotations

import base64
import io
import warnings

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

warnings.filterwarnings("ignore")
import torchxrayvision as xrv  # noqa: E402  (noisy import warnings)

MODEL_WEIGHTS = "densenet121-res224-all"

# Plain-language names; the three cancer-relevant findings come first.
CANCER_RELATED = ["Mass", "Nodule", "Lung Lesion"]
LABELS = {
    "Mass": ("Mass", "A lump-like shadow larger than 3 cm. Can be a tumour, but also infection, scarring or other benign causes."),
    "Nodule": ("Nodule", "A small round spot, 3 cm or less. Most nodules are benign, such as old infections or scars."),
    "Lung Lesion": ("Lung lesion", "A general label for an abnormal area in the lung, including masses and nodules."),
    "Atelectasis": ("Atelectasis", "Part of the lung not fully inflated."),
    "Consolidation": ("Consolidation", "Part of the lung filled with fluid or material, often from pneumonia."),
    "Infiltration": ("Infiltration", "Hazy area in the lung, from many possible causes."),
    "Pneumothorax": ("Pneumothorax", "Air between the lung and chest wall (collapsed lung)."),
    "Edema": ("Pulmonary oedema", "Fluid in the lungs, often heart-related."),
    "Emphysema": ("Emphysema", "Damaged, over-inflated air sacs, usually from smoking."),
    "Fibrosis": ("Fibrosis", "Scarring of lung tissue."),
    "Effusion": ("Pleural effusion", "Fluid around the lung."),
    "Pneumonia": ("Pneumonia", "Lung infection."),
    "Pleural_Thickening": ("Pleural thickening", "Thickened lining around the lung."),
    "Cardiomegaly": ("Enlarged heart", "The heart looks larger than expected."),
    "Hernia": ("Hernia", "Usually a hiatus hernia (stomach pushing up into the chest)."),
    "Fracture": ("Fracture", "A possible broken rib or other bone."),
    "Lung Opacity": ("Lung opacity", "Any area that looks whiter than normal lung."),
    "Enlarged Cardiomediastinum": ("Widened mediastinum", "The central chest area (heart and major vessels) looks wider than expected."),
}

_model: xrv.models.DenseNet | None = None
_transform = None


def load_model() -> None:
    global _model, _transform
    if _model is None:
        torch.set_grad_enabled(False)
        _model = xrv.models.DenseNet(weights=MODEL_WEIGHTS)
        _model.eval()
        import torchvision

        _transform = torchvision.transforms.Compose([xrv.datasets.XRayCenterCrop(), xrv.datasets.XRayResizer(224)])


class NotAnXray(ValueError):
    """The upload doesn't look like an image this model can read."""


# ------------------------------------------------------------------ loading
def _read_dicom(data: bytes) -> np.ndarray:
    import pydicom
    from pydicom.pixels import apply_voi_lut

    ds = pydicom.dcmread(io.BytesIO(data))
    modality = str(getattr(ds, "Modality", "")).upper()
    other = {"MR": "an MRI", "CT": "a CT", "US": "an ultrasound", "PT": "a PET", "NM": "a nuclear medicine"}
    if modality in other:
        raise NotAnXray(f"This DICOM file is {other[modality]} scan. The model only reads chest X-rays.")
    try:
        arr = ds.pixel_array
    except Exception as e:  # compressed formats without a decoder, etc.
        raise NotAnXray(f"Couldn't read the image data in this DICOM file ({e.__class__.__name__}). Try exporting it as PNG.")
    if arr.ndim == 3 and arr.shape[-1] not in (3, 4):  # multi-frame
        arr = arr[0]
    arr = apply_voi_lut(arr, ds).astype(np.float32)
    if str(getattr(ds, "PhotometricInterpretation", "")).upper() == "MONOCHROME1":
        arr = arr.max() - arr  # inverted greyscale
    return arr


def load_image(data: bytes, filename: str) -> np.ndarray:
    """Return a 2D greyscale float array scaled 0-255."""
    is_dicom = filename.lower().endswith((".dcm", ".dicom")) or data[128:132] == b"DICM"
    if is_dicom:
        arr = _read_dicom(data)
    else:
        try:
            img = Image.open(io.BytesIO(data))
            img.load()
        except Exception:
            raise NotAnXray("That file isn't an image this tool can open. Use PNG, JPEG or DICOM.")
        rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
        # X-rays are greyscale. A strongly coloured image is probably a photo.
        sat = (rgb.max(axis=2) - rgb.min(axis=2)).mean()
        if sat > 25:
            raise NotAnXray("This looks like a colour photo, not an X-ray. Upload the X-ray image itself (PNG, JPEG or DICOM).")
        arr = rgb.mean(axis=2)
    if arr.ndim != 2:
        raise NotAnXray("Unexpected image layout.")
    h, w = arr.shape
    if min(h, w) < 128:
        raise NotAnXray("The image is too small. Use the full-size X-ray, at least 128 pixels on each side.")
    if max(h, w) / min(h, w) > 2.0:
        raise NotAnXray("The image is very long and thin, which doesn't look like a chest X-ray.")
    if np.percentile(arr, 99.5) - np.percentile(arr, 0.5) < 1e-6:
        raise NotAnXray("The image is blank.")
    if is_dicom:
        # 12/16-bit data: plain min-max rescale to 0-255, no contrast stretch.
        lo, hi = float(arr.min()), float(arr.max())
        return (arr - lo) / (hi - lo) * 255.0
    # 8-bit images go in unchanged, matching TorchXRayVision's reference
    # preprocessing. (Contrast stretching was found to inflate scores.)
    return arr


# ----------------------------------------------------------------- heatmaps
def _colormap(v: np.ndarray) -> np.ndarray:
    """0..1 -> RGBA heat colours (transparent where low)."""
    stops = np.array([[0.0, 0, 0, 255], [0.35, 0, 160, 255], [0.6, 255, 220, 0], [0.8, 255, 120, 0], [1.0, 230, 20, 20]], dtype=np.float32)
    r = np.interp(v, stops[:, 0], stops[:, 1])
    g = np.interp(v, stops[:, 0], stops[:, 2])
    b = np.interp(v, stops[:, 0], stops[:, 3])
    a = np.clip((v - 0.3) / 0.5, 0, 1) * 170  # hide the weakest 30%
    return np.stack([r, g, b, a], axis=-1).astype(np.uint8)


def _png_data_url(arr: np.ndarray, mode: str) -> str:
    buf = io.BytesIO()
    Image.fromarray(arr, mode=mode).save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ----------------------------------------------------------------- analysis
def analyse(data: bytes, filename: str, heatmap_labels: list[str] | None = None) -> dict:
    load_model()
    assert _model is not None and _transform is not None

    img255 = load_image(data, filename)
    img = xrv.datasets.normalize(img255, 255)[None, ...]  # (1, H, W) in [-1024, 1024]
    img = _transform(img)  # centre crop to square, resize to 224
    x = torch.from_numpy(img).unsqueeze(0).float()  # (1, 1, 224, 224)

    feats = F.relu(_model.features(x))  # (1, 1024, 7, 7)
    pooled = F.adaptive_avg_pool2d(feats, 1).flatten(1)
    logits = _model.classifier(pooled)
    scores = xrv.models.op_norm(torch.sigmoid(logits), _model.op_threshs)[0].numpy()

    findings = []
    for i, name in enumerate(_model.pathologies):
        if not name or name not in LABELS:
            continue
        plain, desc = LABELS[name]
        findings.append({
            "id": name,
            "label": plain,
            "description": desc,
            "score": round(float(scores[i]), 3),
            "flagged": bool(scores[i] >= 0.5),
            # Scores this close to the threshold are coin-flip territory.
            "band": "high" if scores[i] >= 0.55 else "borderline" if scores[i] >= 0.45 else "low",
            "cancerRelated": name in CANCER_RELATED,
        })
    findings.sort(key=lambda f: (not f["cancerRelated"], -f["score"]))

    # Class activation maps: the classifier is linear on pooled features, so
    # weight · feature-map shows exactly which regions raised each score.
    wanted = heatmap_labels or [f["id"] for f in findings if f["cancerRelated"]] + [f["id"] for f in findings if f["flagged"]]
    heatmaps = {}
    W = _model.classifier.weight
    for name in dict.fromkeys(wanted):
        if name not in _model.pathologies:
            continue
        i = _model.pathologies.index(name)
        cam = torch.einsum("c,chw->hw", W[i], feats[0])
        cam = F.interpolate(cam[None, None], size=(448, 448), mode="bilinear", align_corners=False)[0, 0]
        cam = torch.relu(cam)
        peak = float(cam.max())
        if peak <= 0:
            continue  # no region raised this score; the score comes from the model's baseline
        cam = (cam / peak).numpy()
        heatmaps[name] = _png_data_url(_colormap(cam), "RGBA")

    view = (img[0] + 1024) / 2048 * 255  # back to 0-255 for display
    view = np.asarray(Image.fromarray(np.clip(view, 0, 255).astype(np.uint8)).resize((448, 448), Image.BILINEAR))

    return {
        "model": MODEL_WEIGHTS,
        "image": _png_data_url(view, "L"),
        "findings": findings,
        "heatmaps": heatmaps,
    }
