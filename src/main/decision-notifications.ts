interface Toast {on(event:'click',listener:()=>void):unknown;show():void;close():void}
/** One native notification per pending decision; stale decisions are withdrawn. */
export class DecisionNotifications{
 private active=new Map<string,Toast|undefined>()
 constructor(private create:()=>Toast|undefined,private activate:(runId:string)=>void){}
 sync(gates:{id:string;runId:string}[]){
  const current=new Set(gates.map(g=>g.id))
  for(const [id,toast] of this.active)if(!current.has(id)){try{toast?.close()}catch{}this.active.delete(id)}
  for(const gate of gates){
   if(this.active.has(gate.id))continue
   this.active.set(gate.id,undefined)
   try{const toast=this.create();this.active.set(gate.id,toast);toast?.on('click',()=>{if(this.active.has(gate.id))this.activate(gate.runId)});toast?.show()}catch{/* native notification errors must not stop the task */}
  }
 }
}
