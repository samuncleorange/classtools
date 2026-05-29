import { useParams } from 'react-router-dom';
import { useWall } from '../lib/wall';
import { PublicWall } from '../components/PublicWall';

export function WallPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError } = useWall(token);
  if (isLoading) return <div className="p-10 text-center text-slate-400">加载中…</div>;
  if (isError || !data) return <div className="p-10 text-center text-slate-400">链接无效或已失效</div>;
  return <PublicWall data={data} />;
}
