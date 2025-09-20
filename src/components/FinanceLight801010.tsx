import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const CURRENCY = "лв";
const LS_KEY = "emi_finance_light_801010_v2";

const PASTELS = [
  "#c7d2fe", "#fde68a", "#a7f3d0", "#fbcfe8", "#bae6fd", "#fecaca",
  "#ddd6fe", "#bbf7d0", "#f5d0fe", "#fef3c7", "#d1fae5", "#fee2e2",
];

type Income = { id: number; date: string; label: string; amount: number };
type Expense = { id: number; date: string; category: string; note?: string; amount: number };
type Debt = { id: number; name: string; amount: number; done: boolean };

const defaultState = (() => {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) try { return JSON.parse(raw) } catch {}
  return {
    monthISO: new Date().toISOString().slice(0, 7),
    incomes: [] as Income[],
    expenses: [] as Expense[],
    categories: [
      "Дом", "Храна", "Транспорт", "Сметки", "Здраве", "Облекло", "Хоби", "Други",
      "Образование", "Пътуване", "Кафе/Навън", "Подаръци",
    ],
    debts: [] as Debt[],
  }
})();

function usePersistentState<T>(key: string, initial: T) {
  const [state, _setState] = useState<T>(initial);
  const set = (next: T | ((prev: T) => T)) => {
    const value = typeof next === "function" ? (next as (p: T) => T)(state) : next;
    _setState(value);
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  return [state, set] as const;
}

function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function fmtDateHuman(iso: string) {
  if (!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}.${m}.${String(y).slice(2)}`;
}

export default function FinanceLight801010() {
  const [state, setState] = usePersistentState(LS_KEY as any, defaultState);
  const { monthISO, incomes, expenses, categories, debts } = state as any;
  const [tab, setTab] = useState<'input'|'analytics'>('input');

  // ремонт на графиката при завъртане/resize
  const [viewportW, setViewportW] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 0);
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const today = new Date().toISOString().slice(0,10);
  const [expAmount, setExpAmount] = useState<number | ''>('');
  const [expCat, setExpCat] = useState<string>(categories[0] || "Други");
  const [expNote, setExpNote] = useState<string>("");
  const [expDate, setExpDate] = useState<string>(today);

  const [incAmount, setIncAmount] = useState<number | ''>('');
  const [incLabel, setIncLabel] = useState<string>("Приход");
  const [incDate, setIncDate] = useState<string>(today);

  const saveState = (patch: Partial<typeof state> | ((prev: any) => any)) =>
    setState((prev: any) => (typeof patch === "function" ? patch(prev) : ({ ...prev, ...patch })));

  const addExpense = () => {
    const amt = Number(expAmount);
    if (!amt) return;
    const item: Expense = { id: Date.now(), date: expDate, category: expCat, note: expNote.trim(), amount: amt };
    saveState((prev: any) => ({ ...prev, expenses: [item, ...prev.expenses] }));
    setExpAmount(''); setExpNote(""); setExpCat(categories[0] || "Други"); setExpDate(today);
  };
  const addIncome = () => {
    const amt = Number(incAmount);
    if (!amt) return;
    const item: Income = { id: Date.now(), date: incDate, label: incLabel.trim() || "Приход", amount: amt };
    saveState((prev: any) => ({ ...prev, incomes: [item, ...prev.incomes] }));
    setIncAmount(''); setIncLabel("Приход"); setIncDate(today);
  };

  const setMonth = (v: string) => saveState({ monthISO: v });

  const inMonth = (isoDate?: string) => isoDate?.startsWith(monthISO);
  const expMonth = (expenses as Expense[]).filter((e) => inMonth(e.date));
  const incMonth = (incomes as Income[]).filter((i) => inMonth(i.date));

  const totalExp = expMonth.reduce((a, b) => a + (Number(b.amount)||0), 0);
  const totalInc = incMonth.reduce((a, b) => a + (Number(b.amount)||0), 0);
  const balance = totalInc - totalExp;

  const NEEDS = 80, INVEST = 10, FUN = 10;
  const desiredIncome = NEEDS>0 ? totalExp / (NEEDS/100) : 0;
  const desiredDiff = desiredIncome - totalInc;
  const requiredExtra = Math.max(desiredDiff, 0);
  const sNeeds = desiredIncome * (NEEDS/100);
  const sInvest = desiredIncome * (INVEST/100);
  const sFun   = desiredIncome * (FUN/100);

  const byCatMap: Record<string, number> = {};
  (categories as string[]).forEach((c) => byCatMap[c] = 0);
  for (const e of expMonth) byCatMap[e.category] = (byCatMap[e.category]||0) + Number(e.amount||0);
  const byCat = Object.entries(byCatMap).filter(([,v]) => v>0).map(([name, value]) => ({ name, value }));
  const pieData = byCat.length ? byCat : [{ name: "Няма разходи", value: 1 }];

  // само изтриване (по твое желание)
  const deleteExp = (id: number) => {
    saveState((prev: any) => ({ ...prev, expenses: (prev.expenses as Expense[]).filter(e => e.id !== id) }));
  };
  const deleteInc = (id: number) => {
    saveState((prev: any) => ({ ...prev, incomes: (prev.incomes as Income[]).filter(i => i.id !== id) }));
  };

  const [debtName, setDebtName] = useState<string>("");
  const [debtAmount, setDebtAmount] = useState<number|''>('');
  const addDebt = () => {
    const amt = Number(debtAmount);
    if (!debtName.trim() || !amt) return;
    saveState((prev: any) => ({ ...prev, debts: [{ id: Date.now(), name: debtName.trim(), amount: amt, done:false }, ...(prev.debts as Debt[])] }));
    setDebtName(""); setDebtAmount('');
  };
  const toggleDebt = (id: number) => {
    saveState((prev: any) => ({ ...prev, debts: (prev.debts as Debt[]).map(d => d.id===id ? { ...d, done: !d.done } : d) }));
  };
  const deleteDebt = (id: number) => {
    saveState((prev: any) => ({ ...prev, debts: (prev.debts as Debt[]).filter(d => d.id !== id) }));
  };

  const exportCSV = () => {
    const rows: string[] = [];
    rows.push("Тип,Дата,Категория/Етикет,Бележка,Сума");
    for (const e of expMonth) {
      const note = (e.note || "").replace(/,/g, ";");
      rows.push(["Разход", fmtDateHuman(e.date), e.category, note, String(e.amount)].join(","));
    }
    for (const i of incMonth) {
      const label = (i.label || "").replace(/,/g, ";");
      rows.push(["Приход", fmtDateHuman(i.date), label, "", String(i.amount)].join(","));
    }
    const csv = rows.join("\n");
    const blob = new Blob(["\ufeff"+csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `finances_${monthISO}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-dvh bg-[#fafaf7] text-slate-800 overflow-x-hidden">
      <div className="mx-auto max-w-3xl w-full px-3 sm:px-6 py-4 sm:py-6">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between gap-2 min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate"></h1>
          <div className="flex items-center gap-2 min-w-0">
            <nav className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm text-sm flex-shrink-0">
              <button type="button" onClick={()=>setTab('input')} className={`px-3 py-1 rounded-lg ${tab==='input'?'bg-[#f4f1e8]':''}`}>Въвеждане</button>
              <button type="button" onClick={()=>setTab('analytics')} className={`px-3 py-1 rounded-lg ${tab==='analytics'?'bg-[#eaf7f1]':''}`}>Анализ</button>
            </nav>
            <input
              type="month"
              value={monthISO}
              onChange={(e)=>setMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm w-[9.5rem]"
            />
          </div>
        </header>

        {/* Въвеждане */}
        {tab==='input' && (
          <section className="grid gap-3 min-w-0">
            <Card title="Бърз разход">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center min-w-0">
                <input type="date" value={expDate} onChange={e=>setExpDate(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0" />
                <select value={expCat} onChange={e=>setExpCat(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0">
                  {(categories as string[]).map((c)=> <option key={c}>{c}</option>)}
                </select>
                <input placeholder="Бележка (по желание)" value={expNote} onChange={e=>setExpNote(e.target.value)} className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0" />
                <input type="number" inputMode="decimal" placeholder="Сума" value={expAmount} onChange={e=>setExpAmount(Number(e.target.value))} className="col-span-1 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0" />
                <button type="button" onClick={addExpense} className="col-span-1 rounded-xl border border-slate-200 bg-[#f4f1e8] px-3 py-2 text-[16px] hover:bg-[#eee9dc] w-full">Добави</button>
              </div>
            </Card>

            <Card title="Бърз приход">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center min-w-0">
                <input type="date" value={incDate} onChange={e=>setIncDate(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0" />
                <input placeholder="Етикет" value={incLabel} onChange={e=>setIncLabel(e.target.value)} className="col-span-2 sm:col-span-2 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0" />
                <input type="number" inputMode="decimal" placeholder="Сума" value={incAmount} onChange={e=>setIncAmount(Number(e.target.value))} className="col-span-1 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0" />
                <button type="button" onClick={addIncome} className="col-span-1 rounded-xl border border-slate-200 bg-[#eaf7f1] px-3 py-2 text-[16px] hover:bg-[#ddf1e7] w-full">Добави</button>
              </div>
            </Card>
          </section>
        )}

        {/* Анализ */}
        {tab==='analytics' && (
          <section className="grid gap-4 min-w-0">
            {/* Summary */}
           <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 min-w-0">
              <Summary label="Приходи (месец)" value={totalInc} />
              <Summary label="Разходи (месец)" value={totalExp} />
              <Summary label="Нето резултат (Приходи − Разходи)" value={balance} tone={balance>=0?"pos":"neg"} />
              <Summary label="Желан доход" value={desiredIncome}>
            <div className="mt-1 text-[11px] opacity-70">
                Текущ доход: <b className="text-emerald-700">{round2(totalInc)} {CURRENCY}</b>
             <br/>
                 Недостиг: <b className={`${desiredDiff>0?'text-rose-600':desiredDiff<0?'text-emerald-600':''}`}>
                  {round2(desiredDiff)} {CURRENCY}
            </b> {desiredDiff>0? "(за да покриеш модела)" : desiredDiff<0? "(излишък)" : ""}
             <br/>
                 Необходима сума: <b className="text-black">{round2(requiredExtra)} {CURRENCY}</b>
            </div>
             </Summary>
               </div>
            {/* 80/10/10 + Donut + Debts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
              <TinyCard title="Разпределение по 80/10/10">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="opacity-70">Нужди</div><div className="font-medium">{round2(sNeeds)} {CURRENCY}</div></div>
                  <div><div className="opacity-70">Желания</div><div className="font-medium">{round2(sInvest)} {CURRENCY}</div></div>
                  <div><div className="opacity-70">Спестявания</div><div className="font-medium">{round2(sFun)} {CURRENCY}</div></div>
                </div>
              </TinyCard>

              <Donut key={viewportW} title="Къде отидоха парите (категории)" data={pieData} />

              <TinyCard title="Дългове">
                <div className="grid grid-cols-5 gap-2 items-center mb-2">
                  <input placeholder="Име" value={debtName} onChange={e=>setDebtName(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0"/>
                  <input type="number" inputMode="decimal" placeholder="Сума" value={debtAmount} onChange={e=>setDebtAmount(Number(e.target.value))} className="col-span-2 rounded-xl border border-slate-200 px-2 py-2 text-[16px] w-full min-w-0"/>
                  <button type="button" onClick={addDebt} className="col-span-2 rounded-xl border border-slate-200 bg-[#f4f1e8] px-3 py-2 text-[16px] hover:bg-[#eee9dc] w-full">Добави</button>
                </div>
                {(!debts || (debts as Debt[]).length===0) ? (
                  <Empty>Няма въведени дългове.</Empty>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {(debts as Debt[]).map((d)=> (
                      <li key={d.id} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={!!d.done} onChange={()=>toggleDebt(d.id)} />
                          <span className={d.done?"line-through opacity-60 break-words":"break-words"}>{d.name}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{round2(d.amount)} {CURRENCY}</span>
                          <button type="button" onClick={()=>deleteDebt(d.id)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✕</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TinyCard>
            </div>

            {/* Lists */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
              <ListCard title="Записи – Разходи (месец)">
                {expMonth.length===0 ? (
                  <Empty>Няма разходи за този месец.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[5.5rem]" />
                        <col className="w-[7.5rem]" />
                        <col />
                        <col className="w-[6.5rem]" />
                        <col className="w-[3rem]" />
                      </colgroup>
                      <thead>
                        <tr className="text-left text-xs opacity-60">
                          <th className="py-1 whitespace-nowrap">Дата</th>
                          <th className="py-1 whitespace-nowrap">Категория</th>
                          <th className="py-1 whitespace-nowrap">Бележка</th>
                          <th className="py-1 text-right whitespace-nowrap">Сума</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {expMonth.map((e)=> (
                          <tr key={e.id} className="border-t border-slate-100 align-top">
                            <td className="py-1 whitespace-nowrap">{fmtDateHuman(e.date)}</td>
                            <td className="py-1 whitespace-nowrap">{e.category}</td>
                            <td className="py-1 opacity-80 break-words">{e.note}</td>
                            <td className="py-1 text-right whitespace-nowrap font-mono tabular-nums">
                              <span className="font-medium text-rose-700">{round2(e.amount)} {CURRENCY}</span>
                            </td>
                            <td className="py-1 text-right">
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={()=>deleteExp(e.id)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ListCard>

              <ListCard title="Записи – Приходи (месец)">
                {incMonth.length===0 ? (
                  <Empty>Няма приходи за този месец.</Empty>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[5.5rem]" />
                        <col />
                        <col className="w-[6.5rem]" />
                        <col className="w-[3rem]" />
                      </colgroup>
                      <thead>
                        <tr className="text-left text-xs opacity-60">
                          <th className="py-1 whitespace-nowrap">Дата</th>
                          <th className="py-1 whitespace-nowrap">Категория</th>
                          <th className="py-1 text-right whitespace-nowrap">Сума</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {incMonth.map((i)=> (
                          <tr key={i.id} className="border-t border-slate-100 align-top">
                            <td className="py-1 whitespace-nowrap">{fmtDateHuman(i.date)}</td>
                            <td className="py-1 break-words">{i.label}</td>
                            <td className="py-1 text-right whitespace-nowrap font-mono tabular-nums">
                              <span className="font-medium text-emerald-700">{round2(i.amount)} {CURRENCY}</span>
                            </td>
                            <td className="py-1 text-right">
                              <div className="flex justify-end gap-1">
                                <button type="button" onClick={()=>deleteInc(i.id)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✕</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ListCard>
            </div>

            <div className="flex justify-end">
              <button type="button" onClick={exportCSV} className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm hover:bg-slate-50">Експорт в Excel (CSV)</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ------- UI helpers ------- */
const Card: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm w-full max-w-full">
    <div className="mb-2 text-sm font-medium opacity-80 whitespace-nowrap">{title}</div>
    <div className="min-w-0">{children}</div>
  </div>
);

const Summary: React.FC<{ label: string; value: number; hint?: string; tone?: 'pos'|'neg'; children?: React.ReactNode }> = ({ label, value, hint, tone, children }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm w-full max-w-full ${tone==='pos'? 'outline outline-1 outline-emerald-100' : tone==='neg'? 'outline outline-1 outline-rose-100' : ''}`}>
    <div className="text-xs opacity-60">{label}</div>
    <div className={`text-lg font-semibold ${tone==='pos'? 'text-emerald-700' : tone==='neg'? 'text-rose-700' : ''}`}>
      {round2(value)} {CURRENCY}
    </div>
    {hint && <div className="text-[11px] opacity-60 mt-1">{hint}</div>}
    {children}
  </div>
);

const TinyCard: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm w-full max-w-full">
    <div className="mb-2 text-sm font-medium opacity-80">{title}</div>
    <div className="min-w-0">{children}</div>
  </div>
);

const ListCard: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm w-full max-w-full">
    <div className="mb-2 text-sm font-medium opacity-80">{title}</div>
    <div className="min-w-0">{children}</div>
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm opacity-60 w-full max-w-full">{children}</div>
);

const Donut: React.FC<{ title: string; data: { name: string; value: number }[] }> = ({ title, data }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm w-full max-w-full">
    <div className="mb-2 text-sm font-medium opacity-80">{title}</div>
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84}>
            {data.map((_, i) => (
              <Cell key={i} fill={PASTELS[i % PASTELS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
);
