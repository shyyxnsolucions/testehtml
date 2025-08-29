import fs from 'fs';
import path from 'path';

export interface HtmlContent {
  head: string;
  body: string;
}

export function loadHtml(): HtmlContent {
  const filePath = path.join(process.cwd(), 'public', 'hidra.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return {
    head: headMatch ? headMatch[1] : '',
    body: bodyMatch ? bodyMatch[1] : html,
  };
}
