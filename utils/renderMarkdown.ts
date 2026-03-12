/**
 * Lightweight Markdown-to-HTML renderer for announcements.
 * Supports: headers, bold, italic, links, lists, blockquotes, code, horizontal rules, tables.
 * No external dependencies.
 */

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderInline(text: string): string {
    let result = escapeHtml(text);
    // Bold + Italic
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Inline code
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return result;
}

export function renderMarkdown(markdown: string): string {
    if (!markdown) return '';

    const lines = markdown.split('\n');
    const htmlParts: string[] = [];
    let inList: 'ul' | 'ol' | null = null;
    let inBlockquote = false;
    let inTable = false;
    let tableHeaders: string[] = [];

    const closeList = () => {
        if (inList) { htmlParts.push(inList === 'ul' ? '</ul>' : '</ol>'); inList = null; }
    };
    const closeBlockquote = () => {
        if (inBlockquote) { htmlParts.push('</blockquote>'); inBlockquote = false; }
    };
    const closeTable = () => {
        if (inTable) { htmlParts.push('</tbody></table>'); inTable = false; tableHeaders = []; }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Empty line
        if (trimmed === '') {
            closeList();
            closeBlockquote();
            closeTable();
            continue;
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            closeList(); closeBlockquote(); closeTable();
            htmlParts.push('<hr>');
            continue;
        }

        // Headers
        const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            closeList(); closeBlockquote(); closeTable();
            const level = headerMatch[1].length;
            htmlParts.push(`<h${level}>${renderInline(headerMatch[2])}</h${level}>`);
            continue;
        }

        // Table - detect by pipe character at start/end
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
            // Check if next line is separator (---|---|---)
            if (!inTable && i + 1 < lines.length) {
                const nextTrimmed = lines[i + 1]?.trim() || '';
                if (nextTrimmed.startsWith('|') && /^[\s|:-]+$/.test(nextTrimmed)) {
                    // This is a header row
                    closeList(); closeBlockquote();
                    tableHeaders = cells;
                    inTable = true;
                    htmlParts.push('<table><thead><tr>');
                    cells.forEach(c => htmlParts.push(`<th>${renderInline(c)}</th>`));
                    htmlParts.push('</tr></thead><tbody>');
                    i++; // skip separator line
                    continue;
                }
            }
            if (inTable) {
                htmlParts.push('<tr>');
                cells.forEach(c => htmlParts.push(`<td>${renderInline(c)}</td>`));
                htmlParts.push('</tr>');
                continue;
            }
        }

        // Blockquote
        if (trimmed.startsWith('> ')) {
            closeList(); closeTable();
            if (!inBlockquote) { htmlParts.push('<blockquote>'); inBlockquote = true; }
            htmlParts.push(`<p>${renderInline(trimmed.slice(2))}</p>`);
            continue;
        } else {
            closeBlockquote();
        }

        // Unordered list
        if (/^[-*+]\s+/.test(trimmed)) {
            closeTable(); closeBlockquote();
            if (inList !== 'ul') { closeList(); htmlParts.push('<ul>'); inList = 'ul'; }
            htmlParts.push(`<li>${renderInline(trimmed.replace(/^[-*+]\s+/, ''))}</li>`);
            continue;
        }

        // Ordered list
        const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (olMatch) {
            closeTable(); closeBlockquote();
            if (inList !== 'ol') { closeList(); htmlParts.push('<ol>'); inList = 'ol'; }
            htmlParts.push(`<li>${renderInline(olMatch[2])}</li>`);
            continue;
        }

        // Close any open blocks
        closeList(); closeTable();

        // Paragraph
        htmlParts.push(`<p>${renderInline(trimmed)}</p>`);
    }

    closeList();
    closeBlockquote();
    closeTable();

    return htmlParts.join('\n');
}
