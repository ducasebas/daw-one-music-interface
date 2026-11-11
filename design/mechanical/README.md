# Mechanical fit tools

Optional workstation tools, separate from the Pi application and installer. D1 is a nominal fit prototype; read [the design scope](../../docs/design/fit-d1.md) before using the outputs.

The successful run used Python3.12.14 and the versions in [requirements.txt](requirements.txt). A virtual environment is recommended:

```sh
python3 -m venv /tmp/tunebox-cad-env
/tmp/tunebox-cad-env/bin/python -m pip install -r design/mechanical/requirements.txt
```

Collect the files named in [the source manifest](../../docs/design/fit-d1-sources.json) in a separate source directory. Download raw files from GitHub rather than their HTML `blob` pages. Extract the sole `.stp` file from the Waveshare archive and name it `screen.step`. The required local names are `screen.step`, `hat.step`, `pd.step`, `ina.step`, `button.step`, `pct.brd` and `tsl.brd`. The manifest records SHA-256 of the exact files used; do not silently replace revisions and assume identical fit.

```sh
/tmp/tunebox-cad-env/bin/python design/mechanical/fit_d1.py --sources /path/to/manufacturer-files
/tmp/tunebox-cad-env/bin/python design/mechanical/preview_fit_d1.py --sources /path/to/manufacturer-files
```

The first command generates drawings, our case/reference STEP, the prototype core STL and a collision report. It exits with status2 if unexpected nominal intersections remain. `--skip-check` is for drawing work only and does not produce a successful fit check. The second command renders an open-back technical illustration. No files are installed on the Pi and no GPIO or amplifier control is enabled.

Vendor STEP files are not committed. The distributed STEP contains our case and labelled reference envelopes, not a falsely complete vendor assembly. Model output is not a machining, fastening, thermal or electrical release. C1 and its generator remain historical packing studies.
