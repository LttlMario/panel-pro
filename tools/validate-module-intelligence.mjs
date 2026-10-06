import fs from 'node:fs';

const page = fs.readFileSync('administrare-module.html', 'utf8');
const intelligence = fs.readFileSync('js/panel-pro-intelligence.js', 'utf8');
const workbench = fs.readFileSync('js/platform-assistant-workbench.js', 'utf8');
const moduleAssistant = fs.readFileSync('js/panel-module-assistant.js', 'utf8');
const errors = [];
const capabilityMatch = intelligence.match(/const capabilities = \[(.*?)\];/s);
const capabilityCount = capabilityMatch ? (capabilityMatch[1].match(/'[^']*'/g) || []).length : 0;
if (capabilityCount !== 100) errors.push(`capabilități: așteptat 100, găsit ${capabilityCount}`);
for (const required of ['panel-pro-intelligence.js', 'panel-module-assistant.js', 'platform-assistant-workbench.js']) if (!page.includes(required)) errors.push(`script lipsă: ${required}`);
for (const required of ['window.PanelProIntelligence', 'data-intelligence-suggestion', 'data-smart-example', 'panel-intelligence-capabilities']) if (!intelligence.includes(required)) errors.push(`motor inteligență incomplet: ${required}`);
for (const required of ['pagePreflight', 'saveDraft({confirm:true})', 'platform-command-palette', 'state.history', 'showQualityAudit']) if (!workbench.includes(required)) errors.push(`constructor pagini incomplet: ${required}`);
for (const required of ['parseInitialRequest', 'askNextMissing', 'removeField', 'removeButton']) if (!moduleAssistant.includes(required)) errors.push(`constructor module incomplet: ${required}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Audit inteligență administrare-module: 100 capabilități și fluxurile critice sunt prezente.');
