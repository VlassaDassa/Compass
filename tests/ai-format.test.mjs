import test from 'node:test';
import assert from 'node:assert/strict';
import {formatAiMarkdown} from '../dist/ai-format.js';
test('formats headings, lists, strong text and fenced code',()=>{const s=formatAiMarkdown('### Шаг 1\n- **Откройте** Outlook\n- Проверьте почту\n\n```\n<script>\n```');assert.match(s,/<h3>Шаг 1<\/h3>/);assert.match(s,/<ul><li><strong>Откройте<\/strong>/);assert.match(s,/<pre><code>&lt;script&gt;<\/code><\/pre>/);});
test('escapes model HTML and never turns script URLs into links',()=>{const s=formatAiMarkdown('<img src=x onerror=alert(1)> [плохо](javascript:alert(1)) [источник](https://example.org/doc)');assert.ok(!s.includes('<img'));assert.ok(!s.includes('href="javascript:'));assert.match(s,/href="https:\/\/example.org\/doc" target="_blank" rel="noopener noreferrer"/);});
