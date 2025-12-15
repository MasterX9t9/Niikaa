import React from 'react';

interface MarkdownViewProps {
  content: string;
}

// A simplified markdown renderer that handles headers, lists, basic formatting AND Tables AND Images
export const MarkdownView: React.FC<MarkdownViewProps> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  
  let listBuffer: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inList = false;
  let inTable = false;

  const flushList = (keyPrefix: string) => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`${keyPrefix}-ul`} className="list-disc pl-6 mb-4 text-gray-800 dark:text-gray-300 space-y-2">
          {listBuffer}
        </ul>
      );
      listBuffer = [];
      inList = false;
    }
  };

  const renderTable = (rows: string[], keyPrefix: string) => {
      if (rows.length < 2) return null; // Need at least header and separator

      const headerRow = rows[0];
      // simplistic separator check, usually 2nd row, we just ignore it for parsing data but use it to know it's a table
      const bodyRows = rows.slice(2); 

      const parseRow = (row: string) => {
          return row.split('|').map(c => c.trim()).filter(c => c !== '');
      };

      const headers = parseRow(headerRow);

      return (
          <div key={`${keyPrefix}-table`} className="overflow-x-auto mb-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300 border-collapse">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-200">
                      <tr>
                          {headers.map((h, i) => (
                              <th key={i} className="px-6 py-3 border-b border-r last:border-r-0 border-gray-200 dark:border-gray-600 font-bold bg-gray-100 dark:bg-gray-700/80 whitespace-nowrap">{h}</th>
                          ))}
                      </tr>
                  </thead>
                  <tbody>
                      {bodyRows.map((row, i) => {
                          const cells = parseRow(row);
                          if (cells.length === 0) return null;
                          return (
                              <tr key={i} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 last:border-b-0 even:bg-gray-50 dark:even:bg-gray-700/30 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors">
                                  {cells.map((c, j) => (
                                      <td key={j} className="px-6 py-4 border-r last:border-r-0 border-gray-200 dark:border-gray-700 whitespace-normal leading-relaxed">{c}</td>
                                  ))}
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      );
  };

  const flushTable = (keyPrefix: string) => {
      if (tableBuffer.length > 0) {
          const tableNode = renderTable(tableBuffer, keyPrefix);
          if (tableNode) elements.push(tableNode);
          tableBuffer = [];
          inTable = false;
      }
  };

  lines.forEach((line, index) => {
    const key = `line-${index}`;
    const trimLine = line.trim();

    // Table Detection
    if (trimLine.startsWith('|')) {
        flushList(key);
        inTable = true;
        tableBuffer.push(trimLine);
        return;
    } else {
        if (inTable) flushTable(key);
    }

    // Image Detection: ![alt](url)
    if (trimLine.startsWith('![')) {
        flushList(key);
        const match = trimLine.match(/!\[(.*?)\]\((.*?)\)/);
        if (match) {
            elements.push(
                <div key={key} className="my-6">
                    <img src={match[2]} alt={match[1]} className="w-full h-auto rounded-xl shadow-sm" />
                    {match[1] && <p className="text-center text-xs text-gray-500 mt-2 italic">{match[1]}</p>}
                </div>
            );
            return;
        }
    }

    // H1
    if (line.startsWith('# ')) {
      flushList(key);
      elements.push(
        <h1 key={key} className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6 mt-8 leading-tight">
          {line.substring(2)}
        </h1>
      );
      return;
    }

    // H2
    if (line.startsWith('## ')) {
      flushList(key);
      elements.push(
        <h2 key={key} className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-3 mt-6">
          {line.substring(3)}
        </h2>
      );
      return;
    }

    // H3
    if (line.startsWith('### ')) {
      flushList(key);
      elements.push(
        <h3 key={key} className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2 mt-4">
          {line.substring(4)}
        </h3>
      );
      return;
    }

    // List Item
    if (trimLine.startsWith('- ') || trimLine.startsWith('* ')) {
      inList = true;
      const cleanLine = trimLine.substring(2);
      // Basic bold parsing inside list
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="font-semibold text-gray-900 dark:text-gray-100">{part.slice(2, -2)}</strong>;
          }
          return part;
      });

      listBuffer.push(<li key={key}>{renderedParts}</li>);
      return;
    } else {
        if (inList) flushList(key);
    }

    // Paragraph
    if (trimLine !== '') {
      flushList(key);
      
      // Basic bold parsing for paragraphs
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="font-semibold text-gray-900 dark:text-gray-100">{part.slice(2, -2)}</strong>;
          }
          return part;
      });

      elements.push(
        <p key={key} className="mb-4 text-gray-800 dark:text-gray-300 leading-relaxed text-base">
          {renderedParts}
        </p>
      );
    }
  });

  flushList('end');
  flushTable('end');

  return <div className="animate-fade-in pb-20">{elements}</div>;
};