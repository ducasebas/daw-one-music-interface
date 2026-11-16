import React from 'react';
import {tr} from '../shared/i18n.js';
import {Modal} from './Modal.jsx';

export class YoutubeBoundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    const content=<><h3>{tr('This screen could not load.')}</h3><p>{tr('Your music keeps playing. Reconnect and try again.')}</p>{this.props.onClose?<button onClick={this.props.onClose}>{tr('Close')}</button>:<button onClick={()=>location.reload()}>{tr('Try again')}</button>}</>;
    return this.props.onClose?<Modal label="YouTube setup unavailable" onCancel={this.props.onClose}>{content}</Modal>:<section className="video-unavailable" role="alert">{content}</section>;
  }
}
