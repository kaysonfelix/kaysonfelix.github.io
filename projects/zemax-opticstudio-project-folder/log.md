<!--
  PROJECT LOG. Easiest way to post: open admin.html on the live site.
  Each entry starts with:  ## YYYY-MM-DD | Title | Name   (newest at the top)
-->

## 2026-11-05 | Ideal 5x Keplerian Laser Beam Expander at 632.8 nm in Opticstudio | Kayson Felix-Davila

Today I learned Keplerian expanders work by allowing the beam to focus, allowing it to spread, then "recollimate." I also learned how to calculate the lens spacing under afocal image space conditions:the lenses must share a focal point, so the spacing is simply f₁ + f₂.

I worked out the focal lengths and lens spacing by hand before building the simulated model. My notebook page is below.

### My design conditions:
Wavelength: 632.8 nm (HeNe red)
Input beam: 2 mm diameter, afocal image space; parallel light in, parallel light out
Lens 1: ideal paraxial lens, f₁ = 20 mm
Lens 2: ideal paraxial lens, f₂ = 100 mm
Lens spacing: f₁ + f₂ = 120 mm
### My Results
Paraxial ray trace confirmed rays leave parallel with zero angular error
Output beam: 10 mm diameter (5× magnification, M = f2 / f1)

![Zemax OpticStudio](images/2026-11-05-ideal-5x-keplerian-laser-beam-expander-a-1.jpg)

![Paper calculations](images/2026-11-05-ideal-5x-keplerian-laser-beam-expander-a-2.jpg)
