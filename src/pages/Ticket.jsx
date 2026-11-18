import { Link } from 'react-router-dom';

export default function Ticket() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50 p-6 text-center">
      <section className="max-w-lg rounded-2xl bg-white p-8 shadow">
        <h1 className="text-xl font-bold text-slate-900">Vé điện tử chưa sẵn sàng</h1>
        <p className="mt-3 text-sm text-slate-600">Trang vé và tra cứu đặt sân chưa được triển khai.</p>
        <Link className="mt-5 inline-block font-semibold text-emerald-700" to="/">Quay lại danh sách sân</Link>
      </section>
    </main>
  );
}
