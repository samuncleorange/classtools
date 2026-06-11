import { useParams } from 'react-router-dom';
import { useParent } from '../lib/parent';
import { ParentView } from '../components/ParentView';

export function ParentPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError } = useParent(token);
  if (isLoading) return <div className="p-10 text-center text-slate-400">加载中…</div>;
  if (isError || !data) return <div className="p-10 text-center text-slate-400">链接无效或已失效</div>;
  return <ParentView data={data} />;
}
