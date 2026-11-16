import React,{Suspense,lazy} from 'react';
import {tr} from '../shared/i18n.js';

function LoadingPanel(){
 return <section className="deferred-panel" role="status" aria-label={tr('Loading…')}><span className="ui-spinner"/>{tr('Loading…')}</section>;
}
class PanelBoundary extends React.Component{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<section className="deferred-panel" role="alert"><p>{tr('This screen could not load.')}</p><button onClick={()=>location.reload()}>{tr('Try again')}</button></section>:this.props.children;}
}
function deferred(load,name){
 const Component=lazy(()=>load().then(module=>({default:module[name]})));
 return props=><PanelBoundary><Suspense fallback={<LoadingPanel/>}><Component {...props}/></Suspense></PanelBoundary>;
}
export const SettingsPages=deferred(()=>import('./SettingsPages.jsx'),'SettingsPages');
export const TestWorkbench=deferred(()=>import('./TestWorkbench.jsx'),'TestWorkbench');
export const FirstStartWizard=deferred(()=>import('./FirstStartWizard.jsx'),'FirstStartWizard');
