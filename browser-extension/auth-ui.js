// Auth UI logic (runs in privileged extension page so chrome.* APIs are available)
(function(){
  const qs = new URLSearchParams(location.search);
  const mode = qs.get('mode') || 'signin';
  const supabaseUrl = qs.get('url');
  const supabaseKey = qs.get('key');

  const titleEl = document.getElementById('title');
  const submitBtn = document.getElementById('submitBtn');
  const switchBtn = document.getElementById('switchBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const form = document.getElementById('authForm');
  const loading = document.getElementById('loading');
  const msgBox = document.getElementById('messageBox');

  let isSignup = mode === 'signup';
  syncModeText();

  function syncModeText(){
    titleEl.textContent = isSignup ? 'Create Account' : 'Sign In';
    submitBtn.textContent = isSignup ? 'Create Account' : 'Sign In';
    switchBtn.textContent = isSignup ? 'Already have an account? Sign In' : 'Need an account? Sign Up';
  }

  function showMessage(text, kind){
    msgBox.textContent = text;
    msgBox.className = 'msg ' + (kind || '');
  }
  function clearMessage(){ msgBox.textContent=''; msgBox.className='msg'; }

  switchBtn.addEventListener('click', () => { isSignup = !isSignup; clearMessage(); syncModeText(); });
  cancelBtn.addEventListener('click', () => { sendResult({ cancelled:true }); window.close(); });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    clearMessage();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if(!email || !password){ return showMessage('Email & password required','error'); }

    submitBtn.disabled = true; loading.style.display='block';
    try {
      const endpoint = isSignup ? `${supabaseUrl}/auth/v1/signup` : `${supabaseUrl}/auth/v1/token?grant_type=password`;
      const body = isSignup ? { email, password, data:{} } : { email, password };
      const resp = await fetch(endpoint, { method:'POST', headers:{ 'Content-Type':'application/json', apikey: supabaseKey }, body: JSON.stringify(body) });
      const data = await resp.json();
      if(!resp.ok){ throw new Error(data.error_description || data.msg || 'Auth failed'); }

      if(isSignup && !data.access_token){
        showMessage('Check your email to confirm the account, then sign in.','success');
        isSignup = false; syncModeText();
        return;
      }

      if(!data.access_token) throw new Error('No access token in response');

      // Immediately persist minimal snapshot (extension context -> chrome.* OK)
      const snapshot = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        storedAt: Date.now(),
        userProfile: { email }
      };
      chrome.storage.local.set({ userState: snapshot }, ()=> console.log('[auth-ui] userState stored'));
      chrome.storage.local.set({ auth_popup_result: { type:'AUTH_SUCCESS', data: snapshot, timestamp: Date.now() } });

      showMessage('Authentication successful. Closing…','success');
      // Notify opener (popup) via runtime message (postMessage optional fallback)
      sendResult({ success:true, data: snapshot });

      setTimeout(()=> window.close(), 1200);
    } catch(err){
      console.error('[auth-ui] auth error', err);
      showMessage(err.message,'error');
    } finally {
      submitBtn.disabled = false; loading.style.display='none';
    }
  });

  function sendResult(obj){
    try {
      // Runtime message (preferred)
      if(chrome && chrome.runtime) {
        chrome.runtime.sendMessage({ action:'authResult', ...obj });
      }
    } catch(e){ console.warn('[auth-ui] runtime send failed', e); }
    try {
      // Window postMessage (legacy fallback if opener listens)
      if(window.opener){ window.opener.postMessage({ type: obj.success ? 'AUTH_SUCCESS':'AUTH_ERROR', data: obj.data, error: obj.error }, '*'); }
    } catch(e){ console.warn('[auth-ui] postMessage failed', e); }
  }
})();
