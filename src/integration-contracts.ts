/** Contracts shared by the local server adapter and the browser client. */
export type IntegrationState = 'not_configured' | 'connecting' | 'ready' | 'error';
export interface IntegrationStatus { id:string; state:IntegrationState; lastSyncAt?:string; message?:string }
export interface ContextScope { centerId?:string; departmentId?:string; asOf:string }
export interface Citation { articleId:string; version:number; title:string; excerpt:string; url:string }
export interface AssistantRequest { question:string; scope:ContextScope; allowWebSearch:boolean }
export interface AssistantAnswer { text:string; citations:Citation[]; webSources:{title:string;url:string}[]; insufficientContext:boolean }
export interface AnswerProvider {
  readonly kind:'external'|'local';
  /** Server-only. The retrieval layer passes only policy-approved context. */
  answer(question:string,context:Citation[],signal?:AbortSignal):Promise<AssistantAnswer>;
}
export interface KnowledgeRepository {
  search(query:string,scope:ContextScope):Promise<{id:string;title:string;summary:string}[]>;
  publish(id:string,expectedVersion:number,content:{title:string;bodyJSON:unknown;bodyHTML:string;effectiveFrom:string;changeNote:string}):Promise<{version:number}>;
  checkSimilar(title:string,body:string,excludeId?:string):Promise<{id:string;title:string;score:number}[]>;
}
export class IntegrationNotConfigured extends Error {
  constructor(service:string){super(`Интеграция «${service}» ещё не подключена`);this.name='IntegrationNotConfigured';}
}
