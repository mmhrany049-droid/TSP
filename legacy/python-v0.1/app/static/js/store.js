/* وضعیت مشترک برنامه: فراداده، درس‌ها، کتاب‌ها و مباحث */

import { api } from './api.js';

export const state = {
  meta: null,
  labels: {},
  enums: {},
  subjects: [],
  books: [],
  topicTree: [],
  topicsFlat: [],
  bookTrees: {},
  subjectId: localStorage.getItem('tsp.subjectId') || '',
  sampleAvailable: false,
  version: '۰.۱',
};

export function activeSubjectId() {
  return state.subjectId ? Number(state.subjectId) : null;
}

export async function loadMeta() {
  state.meta = await api.get('/meta');
  state.labels = state.meta.labels || {};
  state.enums = state.meta.enums || {};
  state.sampleAvailable = !!state.meta.sample_available;
  state.version = state.meta.app_version || '0.1';
  const version = document.getElementById('app-version');
  if (version) version.textContent = String(state.version).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  return state.meta;
}

export async function loadSubjects() {
  const response = await api.get('/subjects');
  state.subjects = response.items || [];
  const select = document.getElementById('subject-filter');
  if (select) {
    const current = state.subjectId;
    select.innerHTML = '<option value="">همه درس‌ها</option>' + state.subjects.map(
      (subject) => `<option value="${subject.id}">${subject.name}${subject.grade ? ` — ${subject.grade}` : ''}</option>`,
    ).join('');
    select.value = current || '';
  }
  return state.subjects;
}

export async function loadBooks() {
  const response = await api.get('/books', { subject_id: activeSubjectId() || '' });
  state.books = response.items || [];
  return state.books;
}

export async function loadTopics() {
  const response = await api.get('/topics/tree', { subject_id: activeSubjectId() || '' }).catch(() => ({ items: [] }));
  state.topicTree = response.items || [];
  state.topicsFlat = state.topicTree;
  return state.topicTree;
}

export async function loadBookTree(bookId, force = false) {
  if (!force && state.bookTrees[bookId]) return state.bookTrees[bookId];
  const tree = await api.get(`/books/${bookId}/tree`);
  state.bookTrees[bookId] = tree;
  return tree;
}

export function invalidateBookTree(bookId) {
  if (bookId) delete state.bookTrees[bookId];
  else state.bookTrees = {};
}

export async function refreshAll() {
  await Promise.all([loadSubjects(), loadBooks(), loadTopics()]);
}

export async function setSubject(subjectId) {
  state.subjectId = subjectId ? String(subjectId) : '';
  if (state.subjectId) localStorage.setItem('tsp.subjectId', state.subjectId);
  else localStorage.removeItem('tsp.subjectId');
  await refreshAll();
}
