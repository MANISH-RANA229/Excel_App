import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colors, typography, radii, shadows, transitions } from './tokens.js';

// Verify Token Structures
assert.equal(colors.brand.primary, '#15804a', 'Brand primary is Excel green');
assert.ok(colors.brand.accent && colors.text.primary, 'Accent and text colours are present');
const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
assert.ok(css.includes("--xl-green: " + colors.brand.primary), 'theme.css --xl-green matches tokens.js');
assert.ok(css.includes('--bg: ' + colors.surface.canvas), 'theme.css --bg matches tokens.js');
assert.ok(colors.success.bg, 'Success bg is present');
assert.ok(colors.warning.bg, 'Warning bg is present');
assert.ok(colors.danger.base, 'Danger base is present');

// Verify Typography Tokens
assert.ok(typography.fonts.sans.includes('Geist'), 'Sans font uses Geist (same as the landing page)');
assert.ok(typography.fontFeatures.includes('tnum'), 'Font features include tabular numbers');
assert.ok(typography.sizes.base, 'Base font size is defined');

// Verify Radii Constraints (Design rule: maximum 7px on containers/buttons)
assert.equal(radii.default, '7px', 'Default radius is 7px');
assert.equal(radii.lg, '7px', 'Large container radius is 7px');

// Verify UI Component Library Exports via AST / text check to run cleanly in pure Node.js
const uiIndexText = readFileSync(new URL('../components/ui/index.js', import.meta.url), 'utf8');

const REQUIRED_COMPONENTS = [
  'Button',
  'Dropdown',
  'Select',
  'InputText',
  'Input',
  'Checkbox',
  'SelectButton',
  'SegmentedControl',
  'MultiSelect',
  'NumberStepper',
  'NumberInput',
  'Badge',
  'Tag',
  'Card',
  'CardHeader',
  'CardTitle',
  'CardDescription',
  'CardContent',
  'CardFooter',
];

for (const name of REQUIRED_COMPONENTS) {
  assert.ok(
    new RegExp(`\\b${name}\\b`).test(uiIndexText),
    `UI export ${name} is exported in components/ui/index.js`,
  );
}

console.log('theme tokens and UI component library check passed');
