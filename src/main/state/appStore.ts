import { createStore } from './store';
import { initialState, reducer } from './cardFlow';

export const appStore = createStore(initialState, reducer);