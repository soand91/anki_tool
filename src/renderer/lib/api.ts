import { isElectron } from "./env";

type Api = {
  ping: () => Promise<string>;
  deckNames: () => Promise<string[]>;
};

const webMock: Api = {
  async ping() {
    console.warn('[api] using web mock');
    return 'pong (web mock)'
  },
  async deckNames() {
    console.warn('[api] using web mock');
    return ['Default', 'Spanish', 'Biology'];
  },
};

export const api: Api = 
  (isElectron && (window as any).api) ? ((window as any).api as Api) :  webMock;