import type {AgentDetectionState} from '../shared/types'

export class AgentDetection {
  state:AgentDetectionState={status:'searching'}
  private pending:Promise<unknown>|null=null
  constructor(private changed:()=>void=()=>{}){}
  run<T>(detect:()=>Promise<T>):Promise<T>{
    if(this.pending)return this.pending as Promise<T>
    this.state={status:'searching'}
    const publish=()=>{try{this.changed()}catch{/* closed renderer */}}
    this.pending=Promise.resolve().then(detect).then(result=>{
      this.state={status:'ready'};return result
    },error=>{this.state={status:'failed'};throw error}).finally(()=>{this.pending=null;publish()})
    publish()
    return this.pending as Promise<T>
  }
}
