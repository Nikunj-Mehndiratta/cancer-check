# Third-party content and models

This project bundles or uses the following third-party material. Each keeps its own terms, which are separate from this project's code license.

## NICE guideline NG12

The symptom rules in `web/rules.js` are paraphrased from NICE guideline NG12, *Suspected cancer: recognition and referral* (published 2015, last updated 15 April 2026), © NICE 2026, https://www.nice.org.uk/guidance/ng12.

NICE guidance is subject to NICE's notice of rights. It may be reproduced for educational and not-for-profit purposes; commercial use needs NICE's written permission. NG12 was written for healthcare professionals in England and is not intended for self-diagnosis. NICE has not reviewed or endorsed this project.

One rule (vomiting blood → urgent care) follows general NHS urgent-care advice rather than NG12, and the app labels it as such.

## TorchXRayVision

The X-ray analysis uses the TorchXRayVision library (Apache License 2.0), https://github.com/mlmed/torchxrayvision.

> Cohen, J. P., Viviano, J. D., Bertin, P., Morrison, P., Torabian, P., Guarrera, M., Lungren, M. P., Chaudhari, A., Brooks, R., Hashir, M., & Bertrand, H. (2022). TorchXRayVision: A library of chest X-ray datasets and models. *Medical Imaging with Deep Learning*.

The model weights (`densenet121-res224-all`) are **not** included in this repository. TorchXRayVision downloads them on first run. They were trained on public datasets with their own terms (some research-use only, e.g. CheXpert and MIMIC-CXR), so check those terms before any non-research use.

## NIH ChestX-ray14 sample image

`web/samples/nih-00000001_000.png` is from the NIH Clinical Center ChestX-ray14 dataset (via the TorchXRayVision test suite).

> Wang, X., Peng, Y., Lu, L., Lu, Z., Bagheri, M., & Summers, R. M. (2017). ChestX-ray8: Hospital-scale chest X-ray database and benchmarks on weakly-supervised classification and localization of common thorax diseases. *IEEE CVPR*.

The NIH asks users of the dataset to acknowledge the NIH Clinical Center and cite the paper above.
