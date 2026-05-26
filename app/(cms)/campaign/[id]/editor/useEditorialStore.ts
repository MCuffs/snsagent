'use client'

import { create } from 'zustand'
import type { EditorialDocument, EditorialLayer } from '../../../../../src/lib/editor/types'
import { normalizeDocument } from '../../../../../src/lib/editor/document'

interface History {
  past: EditorialDocument[]
  future: EditorialDocument[]
}

interface EditorialState {
  documents: Record<string, EditorialDocument>
  histories: Record<string, History>
  activeSlideId: string | null
  selectedLayerId: string | null
  dirtySlides: Record<string, boolean>
  initialize: (documents: Record<string, EditorialDocument>, activeSlideId: string) => void
  activate: (slideId: string) => void
  selectLayer: (layerId: string | null) => void
  updateDocument: (slideId: string, update: (document: EditorialDocument) => EditorialDocument) => void
  updateLayer: (slideId: string, layerId: string, update: Partial<EditorialLayer>) => void
  reorderLayer: (slideId: string, layerId: string, direction: -1 | 1) => void
  markSaved: (slideId: string) => void
  undo: (slideId: string) => void
  redo: (slideId: string) => void
}

export const useEditorialStore = create<EditorialState>((set) => ({
  documents: {},
  histories: {},
  activeSlideId: null,
  selectedLayerId: 'title',
  dirtySlides: {},
  initialize: (documents, activeSlideId) => set({
    documents,
    activeSlideId,
    selectedLayerId: 'title',
    histories: Object.fromEntries(Object.keys(documents).map(id => [id, { past: [], future: [] }])),
    dirtySlides: {},
  }),
  activate: (slideId) => set({ activeSlideId: slideId, selectedLayerId: 'title' }),
  selectLayer: (layerId) => set({ selectedLayerId: layerId }),
  updateDocument: (slideId, update) => set((state) => {
    const current = state.documents[slideId]
    if (!current) return state
    const next = normalizeDocument(update(current))
    const history = state.histories[slideId] || { past: [], future: [] }
    return {
      documents: { ...state.documents, [slideId]: next },
      histories: {
        ...state.histories,
        [slideId]: { past: [...history.past.slice(-39), current], future: [] },
      },
      dirtySlides: { ...state.dirtySlides, [slideId]: true },
    }
  }),
  updateLayer: (slideId, layerId, update) => set((state) => {
    const current = state.documents[slideId]
    if (!current) return state
    const next = normalizeDocument({
      ...current,
      layers: current.layers.map(layer => layer.id === layerId ? { ...layer, ...update } : layer),
    })
    const history = state.histories[slideId] || { past: [], future: [] }
    return {
      documents: { ...state.documents, [slideId]: next },
      histories: {
        ...state.histories,
        [slideId]: { past: [...history.past.slice(-39), current], future: [] },
      },
      dirtySlides: { ...state.dirtySlides, [slideId]: true },
    }
  }),
  reorderLayer: (slideId, layerId, direction) => set((state) => {
    const current = state.documents[slideId]
    if (!current) return state
    const sorted = [...current.layers].sort((a, b) => a.zIndex - b.zIndex)
    const index = sorted.findIndex(layer => layer.id === layerId)
    const swapIndex = index + direction
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return state
    const originalZ = sorted[index].zIndex
    sorted[index] = { ...sorted[index], zIndex: sorted[swapIndex].zIndex }
    sorted[swapIndex] = { ...sorted[swapIndex], zIndex: originalZ }
    const next = normalizeDocument({ ...current, layers: sorted })
    const history = state.histories[slideId] || { past: [], future: [] }
    return {
      documents: { ...state.documents, [slideId]: next },
      histories: { ...state.histories, [slideId]: { past: [...history.past.slice(-39), current], future: [] } },
      dirtySlides: { ...state.dirtySlides, [slideId]: true },
    }
  }),
  markSaved: (slideId) => set((state) => ({ dirtySlides: { ...state.dirtySlides, [slideId]: false } })),
  undo: (slideId) => set((state) => {
    const current = state.documents[slideId]
    const history = state.histories[slideId]
    const previous = history?.past.at(-1)
    if (!current || !previous) return state
    return {
      documents: { ...state.documents, [slideId]: previous },
      histories: {
        ...state.histories,
        [slideId]: { past: history.past.slice(0, -1), future: [current, ...history.future].slice(0, 40) },
      },
      dirtySlides: { ...state.dirtySlides, [slideId]: true },
    }
  }),
  redo: (slideId) => set((state) => {
    const current = state.documents[slideId]
    const history = state.histories[slideId]
    const next = history?.future[0]
    if (!current || !next) return state
    return {
      documents: { ...state.documents, [slideId]: next },
      histories: {
        ...state.histories,
        [slideId]: { past: [...history.past, current].slice(-40), future: history.future.slice(1) },
      },
      dirtySlides: { ...state.dirtySlides, [slideId]: true },
    }
  }),
}))
