import React from "react";

export function TerminalTable({
  columns,
  rows,
  empty
}: {
  columns: string[];
  rows: Array<Array<React.ReactNode>>;
  empty?: React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <div className="border border-lm-terminal-gray bg-lm-black p-3 text-lm-gray text-sm">
        {empty || "NO DATA"}
      </div>
    );
  }

  return (
    <div className="lm-table-wrap">
      <table className="w-full text-sm">
        <thead className="lm-table-head">
          <tr>
            {columns.map((c) => (
              <th key={c} className="lm-table-th">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-[rgba(255,255,255,0.02)]">
              {r.map((cell, j) => (
                <td key={j} className="lm-table-td">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

