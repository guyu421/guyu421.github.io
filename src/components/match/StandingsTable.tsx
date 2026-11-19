import type { StandingRow } from '@/types/match';

interface StandingsTableProps {
  title?: string;
  rows: StandingRow[];
}

export function StandingsTable({ title = '联赛积分榜', rows }: StandingsTableProps) {
  return (
    <div className="card">
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-border)',
          fontWeight: 800,
          fontSize: '1rem',
        }}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--color-text-muted)',
          }}
        >
          暂无积分榜数据
        </div>
      ) : (
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>球队</th>
              <th>赛</th>
              <th>胜/平/负</th>
              <th style={{ textAlign: 'right' }}>积分</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId}>
                <td className="tabular-nums" style={{ fontWeight: 700 }}>
                  {row.rank}
                </td>
                <td style={{ fontWeight: 600 }}>{row.teamName}</td>
                <td className="tabular-nums">{row.played}</td>
                <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {row.won}/{row.drawn}/{row.lost}
                </td>
                <td
                  className="tabular-nums"
                  style={{ textAlign: 'right', fontWeight: 800 }}
                >
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
