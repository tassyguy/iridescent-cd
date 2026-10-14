# Iridescent CD

A white-background Three.js listening room with two selectable CDs. Click a 3D disc or its selection button to bring it into focus and reveal its Spotify playlist. Drag freely through 360°, scroll to zoom, pause the gentle auto-rotation, or flip to the clear plastic reverse. Arrow keys rotate and Space toggles motion. Reduced-motion preferences disable auto-rotation and selection transitions initially.

## Collection and playback

The two temporary discs, Alpine air and Blue hours, use local Unsplash photographs. Both currently reference `spotify:playlist:7vFQNWXoblEJXpbnTuyz76` (triple j's New Music Hitlist). Edit the `cds` entries in `collection.js` to change their names, artwork, and playlist URIs. The original supplied artwork is retained as `disc.jpg`.

Spotify's official iFrame API supplies play/pause and restart controls; its embedded player supplies track selection and available skip controls. A single player persists when switching between CDs with the same playlist. Closing the panel pauses playback. If the API cannot load, a standard Spotify iframe and an Open Spotify link remain available. Playback can be limited to previews depending on Spotify's account, browser, and content availability. No Spotify credentials are stored by this app.

## Run

Requires Node.js 18 or newer. Run `node server.mjs` and open http://127.0.0.1:5173. No build step or CDN is required; Three.js 0.180.0 is vendored locally.

## Materials

Sealed annular geometry gives the disc physical thickness and a real center hole. Physical materials use polycarbonate IOR 1.586, transmission, dispersion, clearcoat, Fresnel reflections, thin-film interference, and a generated PMREM studio environment. A radial shader approximates diffraction from CD grooves. This is real-time PBR rather than a spectral optical simulation. The clear reverse is an artistic interpretation requested for this viewer; an ordinary CD's aluminum data layer would make its reverse reflective and opaque.

Temporary artwork is from Unsplash's public image CDN, stored locally for reliable loading:

- Alpine: https://images.unsplash.com/photo-1464822759023-fed622ff2c3b
- Ocean: https://images.unsplash.com/photo-1518837695005-2083093ee35b

Artwork belongs to its respective owner. Three.js is MIT licensed; see LICENSE. Spotify remains responsible for its embedded content and playback.

## GitHub Pages

In repository Settings → Pages, choose Deploy from a branch, `main`, `/ (root)`, then Save. All asset references are relative and work under a repository Pages URL.

