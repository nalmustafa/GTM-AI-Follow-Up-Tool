from pathlib import Path
from playwright.sync_api import sync_playwright, expect
import json

root = Path(__file__).resolve().parents[1]
html = (root / 'public' / 'index.html').read_text()
css = (root / 'public' / 'style.css').read_text()
html = html.replace('<link rel="stylesheet" href="style.css" />', '<style>' + css + '</style>')
app_js = (root / 'public' / 'app.js').read_text()
html = html.replace('<script src="app.js"></script>', '')

tasks = json.loads((root / 'data' / 'tasks.json').read_text())
contacts = {c['contact_id']: c for c in json.loads((root / 'data' / 'contacts.json').read_text())}
companies = {c['company_id']: c for c in json.loads((root / 'data' / 'companies.json').read_text())}
contexts = {n['notion_context_id']: n for n in json.loads((root / 'data' / 'notionContext.json').read_text())}
hydrated = []
for task in tasks:
    item = dict(task)
    item['contact'] = contacts.get(task['contact_id'])
    item['company'] = companies.get(task['company_id'])
    item['notion_context'] = contexts.get(task['notion_context_id'])
    item['source_status'] = 'Notion page linked' if item['notion_context'] else 'No context linked'
    hydrated.append(item)

mock = f'''
<script>
const allTasks = {json.dumps(hydrated)};
function mockGenerate(payload) {{
  if (payload.task_id === 'task_004') {{
    return {{
      success: true,
      blocked: true,
      mode: 'blocked',
      warning: 'Draft blocked because the task is not ready or context is incomplete.',
      mapped: {{
        use_case: payload.contact.primary_use_case,
        contact_role: payload.contact.job_title,
        buyer_role: payload.contact.buyer_role,
        buyer_persona: payload.contact.job_title,
        likely_workflow: payload.contact.primary_use_case,
        specific_problem: payload.notion_context.technical_pain,
        routing_confidence: 0,
        missing_context: 'No specific scientific workflow pain was captured.',
        recommended_next_step: 'Ask owner to add context or close out before drafting.'
      }},
      draft: '',
      quality_check: {{approved:false, reason:'Blocked to avoid a generic or unsupported follow up draft.'}}
    }};
  }}
  return {{
    success: true,
    mode: 'fallback',
    mapped: {{
      use_case: payload.contact.primary_use_case,
      contact_role: payload.contact.job_title,
      buyer_role: payload.contact.buyer_role,
      buyer_persona: payload.contact.job_title,
      likely_workflow: payload.contact.primary_use_case,
      specific_problem: payload.notion_context.technical_pain,
      routing_confidence: 95,
      recommended_next_step: payload.notion_context.recommended_next_step
    }},
    draft: 'Hi ' + payload.contact.first_name + ',\\n\\nGood speaking at ESACT.\\n\\nYou mentioned ' + payload.notion_context.technical_pain.toLowerCase() + ' Would it be useful to compare where this sits in the current workflow?',
    quality_check: {{approved:true, reason:'Specific and short.'}}
  }};
}}
window.fetch = async function(url, opts={{}}) {{
  const href = String(url);
  if (href.startsWith('/api/config/status')) return new Response(JSON.stringify({{hubspot_mode:'simulated', notion_mode:'simulated', openai_configured:false, openai_model:'gpt-4.1-mini', gmail_configured:true, gmail_authorized:false, gmail_mode:'simulated', gmail_send_enabled:false, gmail_send_mode:'simulated'}}), {{headers:{{'Content-Type':'application/json'}}}});
  if (href.startsWith('/api/metrics')) return new Response(JSON.stringify({{metrics:[], dashboard_rows:[]}}), {{headers:{{'Content-Type':'application/json'}}}});
  if (href.startsWith('/api/tasks')) {{
    const sorted = [...allTasks].sort((a,b)=> new Date(a.due_date_iso) - new Date(b.due_date_iso));
    return new Response(JSON.stringify({{tasks: sorted, pagination:{{page:1, pageSize:25, total:sorted.length, totalPages:1, sortDir:'asc'}}, sync_filter:'Open or overdue follow-up tasks with an associated contact.'}}), {{headers:{{'Content-Type':'application/json'}}}});
  }}
  if (href.startsWith('/api/generate-draft')) {{
    const payload = JSON.parse(opts.body || '{{}}');
    return new Response(JSON.stringify(mockGenerate(payload)), {{headers:{{'Content-Type':'application/json'}}}});
  }}
  return new Response(JSON.stringify({{success:true}}), {{headers:{{'Content-Type':'application/json'}}}});
}};
</script>
'''
html += mock + '<script>' + app_js + '</script>'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1200})
    page.set_content(html, wait_until='domcontentloaded')
    expect(page.locator('#tasksTableBody tr')).to_have_count(4)
    expect(page.locator('#taskPageStatus')).to_contain_text('Showing 1-4 of 4')
    expect(page.locator('.task-table-card')).to_have_count(1)
    table_metrics = page.locator('.task-table-card').evaluate('el => ({height: Math.round(el.getBoundingClientRect().height), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth})')
    assert table_metrics['height'] == 500, table_metrics
    assert table_metrics['scrollWidth'] <= table_metrics['clientWidth'] + 2, table_metrics
    task_w = page.locator('.task-queue-table td.task-cell').first.evaluate('el => Math.round(el.getBoundingClientRect().width)')
    role_w = page.locator('.task-queue-table td.role-cell').first.evaluate('el => Math.round(el.getBoundingClientRect().width)')
    status_w = page.locator('.task-queue-table td.status-cell').first.evaluate('el => Math.round(el.getBoundingClientRect().width)')
    assert task_w >= 445, {'task_w': task_w, 'role_w': role_w, 'status_w': status_w}
    assert role_w < 120, {'task_w': task_w, 'role_w': role_w, 'status_w': status_w}
    assert status_w >= 85, {'task_w': task_w, 'role_w': role_w, 'status_w': status_w}
    row_spacing = page.locator('.task-queue-table td.task-cell').first.evaluate('''el => {
      const primary = el.querySelector('.primary-line');
      const secondary = el.querySelector('.secondary-line');
      const pb = primary.getBoundingClientRect();
      const sb = secondary.getBoundingClientRect();
      return { gap: Math.round((sb.top - pb.bottom) * 10) / 10, primaryDisplay: getComputedStyle(primary).display, secondaryDisplay: getComputedStyle(secondary).display };
    }''')
    assert row_spacing['gap'] <= 2, row_spacing
    assert row_spacing['primaryDisplay'] == 'block', row_spacing
    company_spacing = page.locator('.task-queue-table td.company-cell').first.evaluate('''el => {
      const primary = el.querySelector('.primary-line');
      const secondary = el.querySelector('.secondary-line');
      const pb = primary.getBoundingClientRect();
      const sb = secondary.getBoundingClientRect();
      return { gap: Math.round((sb.top - pb.bottom) * 10) / 10, primaryDisplay: getComputedStyle(primary).display, secondaryDisplay: getComputedStyle(secondary).display };
    }''')
    assert company_spacing['gap'] <= 2, company_spacing
    page.screenshot(path=str(root / 'qa' / 'validated_v33_tasks_table.png'), full_page=True)

    page.locator('[data-row-task-id="task_003"]').click()
    expect(page.locator('#inputSummary')).to_contain_text('Contact role')
    expect(page.locator('#inputSummary')).to_contain_text('Buyer role')
    expect(page.locator('#inputSummary')).to_contain_text('User')
    expect(page.locator('#inputSummary')).to_contain_text('Source')
    expect(page.locator('#inputSummary')).to_contain_text('Primary use case')
    expect(page.locator('#inputSummary')).to_contain_text('Context summary')
    expect(page.locator('#inputSummary')).to_contain_text('Source context note')
    expect(page.locator('#inputSummary')).to_contain_text('Protein Scientist')
    expect(page.locator('#inputSummary')).to_contain_text('ESACT 2026')
    expect(page.locator('#inputSummary')).to_contain_text('His tagged protein')

    page.locator('#generateDraftBtn').click()
    expect(page.locator('#mapperOutput')).to_contain_text('Contact role')
    expect(page.locator('#mapperOutput')).to_contain_text('Buyer role')
    expect(page.locator('#mapperOutput')).to_contain_text('Likely workflow')
    expect(page.locator('#mapperOutput')).to_contain_text('95%')
    expect(page.locator('#draftEditor')).not_to_have_value('')

    page.locator('[data-view="tasksView"]').click()
    page.locator('[data-row-task-id="task_004"]').click()
    page.locator('#generateDraftBtn').click()
    expect(page.locator('#mapperOutput')).to_contain_text('Blocked to protect quality')
    expect(page.locator('#draftEditor')).to_have_value('')
    expect(page.locator('#createDraftBtn')).to_be_disabled()
    expect(page.locator('#sendEmailBtn')).to_be_disabled()

    page.locator('[data-view="setupView"]').click()
    expect(page.locator('#mappingRows')).to_contain_text('Task status')
    page.locator('[data-mapping-tab="contactCompany"]').click()
    expect(page.locator('#mappingRows')).to_contain_text('Lead source')
    expect(page.locator('#mappingRows')).to_contain_text('Conference lead status')
    expect(page.locator('#mappingRows')).to_contain_text('No deal follow-up flag')
    expect(page.locator('#mappingRows')).to_contain_text('Application area')
    page.locator('[data-mapping-tab="mapperOutput"]').click()
    expect(page.locator('#mappingRows')).to_contain_text('Contact role')
    expect(page.locator('#mappingRows')).to_contain_text('Buyer role')
    expect(page.locator('#mappingRows')).to_contain_text('Routing confidence')
    expect(page.locator('#mappingRows')).to_contain_text('Draft readiness status')
    page.screenshot(path=str(root / 'qa' / 'validated_v33_mapper_alignment.png'), full_page=True)
    browser.close()
print('v33 mapper alignment, workflow and task-row spacing validation passed')
