import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView; tests that care replace this with a spy.
HTMLElement.prototype.scrollIntoView = function () {};
