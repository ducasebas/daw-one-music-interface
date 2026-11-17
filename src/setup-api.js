export async function setupApi(path,token,body){
 const response=await fetch(path,{cache:'no-store',method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-TuneBox-Control':token||''},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Setup could not be saved. Please try again.'),{status:response.status});return result;
}
export async function saveSetupPreferences(token,patch){const current=await setupApi('/api/preferences',token);return setupApi('/api/preferences',token,{revision:current.revision,patch:{...patch,...(patch.prefs?{prefs:{...current.prefs,...patch.prefs}}:{})}});}
