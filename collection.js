export const playlist = 'spotify:playlist:7vFQNWXoblEJXpbnTuyz76';
export const cds = [
  { title: 'Alpine air', description: 'A little room to breathe.', artwork: './cd-alpine.jpg', playlist },
  { title: 'Blue hours', description: 'Let the world drift a little.', artwork: './cd-ocean.jpg', playlist },
];

// Keep one official player alive while switching discs with the same playlist.
export function createPlaylistPanel() {
  let controller = null, currentUri = null, apiStarted = false, fallbackTimer, usingFallback = false;
  const panel = document.querySelector('#playlist-panel');
  const shell = document.querySelector('#spotify-shell');
  const transport = document.querySelector('#transport');
  const play = document.querySelector('#play');
  const restart = document.querySelector('#restart');
  const status = document.querySelector('#playback-status');
  const link = document.querySelector('#spotify-link');
  function fallback() {
    if (controller || usingFallback) return;
    usingFallback = true;
    shell.replaceChildren();
    const iframe = document.createElement('iframe');
    iframe.title = 'Spotify playlist and playback controls';
    iframe.src = `https://open.spotify.com/embed/playlist/${currentUri.split(':').pop()}?theme=0`;
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    shell.append(iframe);
    status.textContent = 'Use the player controls, or open Spotify to listen.';
  }
  window.onSpotifyIframeApiReady = api => {
    if (usingFallback) return;
    api.createController(document.querySelector('#spotify-player'), {uri:currentUri,width:'100%',height:352}, player => {
      controller = player;
      clearTimeout(fallbackTimer);
      const iframe = shell.querySelector('iframe');
      if (iframe) iframe.title = 'Spotify playlist and playback controls';
      controller.addListener('ready', () => {
        transport.hidden = false; play.disabled = restart.disabled = false;
        status.textContent = 'Playback availability is managed by Spotify.';
      });
      controller.addListener('playback_update', event => {
        const paused = event.data.isPaused;
        play.innerHTML = paused ? '▶ <span>Play</span>' : 'Ⅱ <span>Pause</span>';
        play.setAttribute('aria-label', paused ? 'Play playlist' : 'Pause playlist');
        play.setAttribute('aria-pressed',String(!paused));
      });
    });
  };
  play.onclick = () => controller?.togglePlay();
  restart.onclick = () => controller?.restart();
  return {
    show(index) {
      const cd = cds[index];
      panel.hidden = false;
      document.querySelector('#disc-title').textContent = cd.title;
      document.querySelector('#disc-description').textContent = cd.description;
      document.querySelector('#disc-number').textContent = `DISC ${String(index+1).padStart(2,'0')} / IN FOCUS`;
      link.href = `https://open.spotify.com/playlist/${cd.playlist.split(':').pop()}`;
      if (currentUri === cd.playlist) return;
      currentUri = cd.playlist;
      if(controller) controller.loadEntity(currentUri);
      else if(!apiStarted) {
        apiStarted = true;
        status.textContent = 'Loading Spotify…';
        const script = document.createElement('script');
        script.src = 'https://open.spotify.com/embed/iframe-api/v1';
        script.onerror = fallback;
        document.head.append(script);
        fallbackTimer = setTimeout(fallback,12000);
      }
    },
    hide() {
      controller?.pause();
      if(usingFallback){shell.querySelector('iframe').src='about:blank';usingFallback=false;apiStarted=false;currentUri=null;shell.innerHTML='<div id="spotify-player"></div>';}
      panel.hidden = true;
    },
  };
}
