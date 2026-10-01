import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView; tests that care replace this with a spy.
if (typeof HTMLElement !== 'undefined') {
  HTMLElement.prototype.scrollIntoView = function () {};
}
