# Specifications & Resources

## GDTF — General Device Type Format

Open standard for describing controllable devices (luminaires, fog machines, etc.) in the entertainment industry. A `.gdtf` file is a ZIP archive containing a `description.xml` and resource files (3D models in glTF/3DS, images in PNG/SVG).

| Resource | URL |
|----------|-----|
| DIN SPEC 15800 (formal standard) | https://webstore.ansi.org/standards/din/DINSPEC158002022 |
| Specification (Markdown) | https://github.com/mvrdevelopment/spec/blob/main/gdtf-spec.md |
| GDTF Hub (readable docs) | https://www.gdtf.eu/ |
| File format definition | https://www.gdtf.eu/gdtf/file-spec/file-format-definition/ |
| GitHub org | https://github.com/mvrdevelopment |

Current version: **DIN SPEC 15800:2022-02** (GDTF v1.2)

## MVR — My Virtual Rig

Sibling standard built on top of GDTF. Defines a file format for exchanging complete show setups (fixture placement, trusses, video screens, scenic elements) between lighting consoles, CAD, and visualizers.

| Resource | URL |
|----------|-----|
| DIN SPEC 15801 (formal standard) | https://www.dinmedia.de/en/technical-rule/din-spec-15801/373968511 |
| Specification (Markdown) | https://github.com/mvrdevelopment/spec/blob/main/mvr-spec.md |
| MVR docs (GDTF Hub) | https://www.gdtf.eu/mvr/prologue/introduction/ |

Current version: **DIN SPEC 15801:2023-12** (MVR v1.6)

## GDTF Share

Central database of manufacturer-uploaded GDTF fixture files. Provides a web UI for browsing/downloading fixtures and a REST API for programmatic access.

| Resource | URL |
|----------|-----|
| GDTF Share (fixture library) | https://gdtf-share.com/ |
| GDTF Builder (web editor) | https://fixturebuilder.gdtf-share.com/ |
| Help pages | https://gdtf-share.com/help/ |
| REST API docs | https://www.gdtf.eu/gdtf/share_api/share-api/ |
| REST API docs (GitHub) | https://github.com/mvrdevelopment/tools/blob/main/GDTF_Share_API/GDTF%20Share%20API.md |
| Developer page | https://gdtf-share.com/landing/pages/developer.php |

API base URL: `https://gdtf-share.com/apis/public/` (requires registered account, session cookie with 2h timeout).

## Tools & Libraries

| Resource | URL |
|----------|-----|
| libMVRgdtf (C++ library) | https://github.com/mvrdevelopment/libMVRgdtf |
| Tools repository | https://github.com/mvrdevelopment/tools |
| Spec releases / changelog | https://github.com/mvrdevelopment/spec/releases |

## Founders

GDTF and MVR are jointly maintained by **MA Lighting**, **Robe Lighting**, and **Vectorworks**.
