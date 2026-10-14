# Iridescent CD

A minimal, white-background Three.js viewer using the supplied CD artwork. Drag freely through 360°, scroll to zoom, pause the gentle auto-rotation, or flip to the clear plastic reverse. Arrow keys rotate and Space toggles motion. Reduced-motion preferences disable auto-rotation initially.

## Run

Requires Node.js 18 or newer. Run `node server.mjs` and open http://127.0.0.1:5173. No build step or CDN is required; Three.js 0.180.0 is vendored locally.

## Materials

Sealed annular geometry gives the disc physical thickness and a real center hole. Physical materials use polycarbonate IOR 1.586, transmission, dispersion, clearcoat, Fresnel reflections, thin-film interference, and a generated PMREM studio environment. A radial shader approximates diffraction from CD grooves. This is real-time PBR rather than a spectral optical simulation. The clear reverse is an artistic interpretation requested for this viewer; an ordinary CD's aluminum data layer would make its reverse reflective and opaque.

The supplied photograph already includes rainbow highlights; those remain in the printed texture beneath the dynamic reflections. Artwork belongs to its respective owner. Three.js is MIT licensed; see LICENSE.

## GitHub Pages

In repository Settings → Pages, choose Deploy from a branch, `main`, `/ (root)`, then Save. All asset references are relative and work under a repository Pages URL.

