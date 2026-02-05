import {
  getLuminance,
  getContrastRatio,
  parseColor,
  meetsContrastRequirements,
  quickA11yAudit,
  WCAG_AA_CONTRAST,
} from './accessibility';

describe('Accessibility Utilities', () => {
  describe('getLuminance', () => {
    it('calculates luminance for white', () => {
      const luminance = getLuminance(255, 255, 255);
      expect(luminance).toBeCloseTo(1, 5);
    });

    it('calculates luminance for black', () => {
      const luminance = getLuminance(0, 0, 0);
      expect(luminance).toBeCloseTo(0, 5);
    });

    it('calculates luminance for red', () => {
      const luminance = getLuminance(255, 0, 0);
      expect(luminance).toBeCloseTo(0.2126, 3);
    });
  });

  describe('getContrastRatio', () => {
    it('calculates 21:1 for black on white', () => {
      const ratio = getContrastRatio(
        { r: 255, g: 255, b: 255 },
        { r: 0, g: 0, b: 0 }
      );
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('calculates 1:1 for same colors', () => {
      const ratio = getContrastRatio(
        { r: 128, g: 128, b: 128 },
        { r: 128, g: 128, b: 128 }
      );
      expect(ratio).toBeCloseTo(1, 0);
    });

    it('calculates correct ratio for typical text colors', () => {
      // Dark gray text on white background
      const ratio = getContrastRatio(
        { r: 255, g: 255, b: 255 },
        { r: 51, g: 51, b: 51 }
      );
      expect(ratio).toBeGreaterThan(10);
    });
  });

  describe('parseColor', () => {
    it('parses hex colors', () => {
      expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColor('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('parses hex colors without hash', () => {
      expect(parseColor('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('parses rgb colors', () => {
      expect(parseColor('rgb(255, 255, 255)')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColor('rgb(0, 0, 0)')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('parses rgba colors', () => {
      expect(parseColor('rgba(255, 255, 255, 0.5)')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('returns null for invalid colors', () => {
      expect(parseColor('invalid')).toBeNull();
      expect(parseColor('red')).toBeNull(); // Named colors not supported
    });
  });

  describe('meetsContrastRequirements', () => {
    it('returns true for high contrast normal text', () => {
      expect(meetsContrastRequirements(4.5)).toBe(true);
      expect(meetsContrastRequirements(5.0)).toBe(true);
    });

    it('returns false for low contrast normal text', () => {
      expect(meetsContrastRequirements(4.4)).toBe(false);
      expect(meetsContrastRequirements(3.0)).toBe(false);
    });

    it('returns true for high contrast large text', () => {
      expect(meetsContrastRequirements(3.0, true)).toBe(true);
      expect(meetsContrastRequirements(4.0, true)).toBe(true);
    });

    it('returns false for low contrast large text', () => {
      expect(meetsContrastRequirements(2.9, true)).toBe(false);
    });
  });

  describe('WCAG_AA_CONTRAST constants', () => {
    it('has correct values', () => {
      expect(WCAG_AA_CONTRAST.normalText).toBe(4.5);
      expect(WCAG_AA_CONTRAST.largeText).toBe(3.0);
    });
  });

  describe('quickA11yAudit', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement('div');
      document.body.appendChild(container);
      // Set lang attribute to avoid false positive in tests
      document.documentElement.setAttribute('lang', 'en');
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('detects images without alt text', () => {
      container.innerHTML = '<img src="test.jpg">';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(1);
      expect(issues[0].issue).toBe('Image missing alt attribute');
      expect(issues[0].severity).toBe('critical');
    });

    it('passes for images with alt text', () => {
      container.innerHTML = '<img src="test.jpg" alt="Test image">';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });

    it('detects form inputs without labels', () => {
      container.innerHTML = '<input type="text" id="test">';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(1);
      expect(issues[0].issue).toBe('Form input missing accessible label');
    });

    it('passes for inputs with label', () => {
      container.innerHTML = `
        <label for="test">Test Label</label>
        <input type="text" id="test">
      `;
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });

    it('passes for inputs with aria-label', () => {
      container.innerHTML = '<input type="text" aria-label="Test input">';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });

    it('ignores hidden inputs', () => {
      container.innerHTML = '<input type="hidden" name="token">';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });

    it('detects buttons without accessible names', () => {
      container.innerHTML = '<button><svg></svg></button>';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(1);
      expect(issues[0].issue).toBe('Button missing accessible name');
    });

    it('passes for buttons with text', () => {
      container.innerHTML = '<button>Click me</button>';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });

    it('passes for buttons with aria-label', () => {
      container.innerHTML = '<button aria-label="Close"><svg></svg></button>';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });

    it('detects skipped heading levels', () => {
      container.innerHTML = '<h1>Title</h1><h3>Skipped h2</h3>';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(1);
      expect(issues[0].issue).toContain('Heading level skipped');
    });

    it('passes for sequential heading levels', () => {
      container.innerHTML = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });

    it('detects positive tabindex values', () => {
      container.innerHTML = '<button tabindex="5">Bad focus order</button>';
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(1);
      expect(issues[0].issue).toContain('Positive tabindex');
    });

    it('passes for tabindex 0 or -1', () => {
      container.innerHTML = `
        <button tabindex="0">Normal focus</button>
        <div tabindex="-1">Programmatic focus only</div>
      `;
      const issues = quickA11yAudit(container);
      expect(issues).toHaveLength(0);
    });
  });
});
