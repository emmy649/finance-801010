import React, { useState } from "react";
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
      "Жилище", "Храна", "Транспорт", "Сметки", "Здраве", "Облекло", "Дом/Хоби", "Други",
      "Образование", "Пътуване", "Кафе/Навън", "Подаръци",
    ],
    debts: [] as Debt[],
  }
})();

function usePersistentState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(initial);
  const set = (next: T) => {
    setState(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
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

  const today = new Date().toISOString().slice(0,10);
  const [expAmount, setExpAmount] = useState<number | ''>('');
  const [expCat, setExpCat] = useState<string>(categories[0] || "Други");
  const [expNote, setExpNote] = useState<string>("");
  const [expDate, setExpDate] = useState<string>(today);

  const [incAmount, setIncAmount] = useState<number | ''>('');
  const [incLabel, setIncLabel] = useState<string>("Приход");
  const [incDate, setIncDate] = useState<string>(today);

  const saveState = (patch: any) => setState({ ...(state as any), ...patch });

  const addExpense = () => {
    const amt = Number(expAmount);
    if (!amt) return;
    const item: Expense = { id: Date.now(), date: expDate, category: expCat, note: expNote.trim(), amount: amt };
    saveState({ expenses: [item, ...expenses] });
    setExpAmount(''); setExpNote(""); setExpCat(categories[0] || "Други"); setExpDate(today);
  };
  const addIncome = () => {
    const amt = Number(incAmount);
    if (!amt) return;
    const item: Income = { id: Date.now(), date: incDate, label: incLabel.trim() || "Приход", amount: amt };
    saveState({ incomes: [item, ...incomes] });
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

  const [editExpId, setEditExpId] = useState<number|null>(null);
  const [editExpDraft, setEditExpDraft] = useState<any>({});
  const startEditExp = (row: Expense) => { setEditExpId(row.id); setEditExpDraft({ ...row }); };
  const saveEditExp = () => {
    saveState({ expenses: (expenses as Expense[]).map((e)=> e.id===editExpId ? editExpDraft : e) });
    setEditExpId(null);
  };
  const deleteExp = (id: number) => { saveState({ expenses: (expenses as Expense[]).filter((e)=> e.id!==id) }); };

  const [editIncId, setEditIncId] = useState<number|null>(null);
  const [editIncDraft, setEditIncDraft] = useState<any>({});
  const startEditInc = (row: Income) => { setEditIncId(row.id); setEditIncDraft({ ...row }); };
  const saveEditInc = () => {
    saveState({ incomes: (incomes as Income[]).map((e)=> e.id===editIncId ? editIncDraft : e) });
    setEditIncId(null);
  };
  const deleteInc = (id: number) => { saveState({ incomes: (incomes as Income[]).filter((e)=> e.id!==id) }); };

  const [debtName, setDebtName] = useState<string>("");
  const [debtAmount, setDebtAmount] = useState<number|''>('');
  const addDebt = () => {
    const amt = Number(debtAmount);
    if (!debtName.trim() || !amt) return;
    saveState({ debts: [{ id: Date.now(), name: debtName.trim(), amount: amt, done:false }, ...(debts as Debt[])] });
    setDebtName(""); setDebtAmount('');
  };
  const toggleDebt = (id: number) => {
    saveState({ debts: (debts as Debt[]).map((d)=> d.id===id ? { ...d, done: !d.done } : d) });
  };
  const deleteDebt = (id: number) => { saveState({ debts: (debts as Debt[]).filter((d)=> d.id!==id) }); };

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
    <div className="min-h-dvh bg-[#fafaf7] text-slate-800">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Финанси 80/10/10</h1>
          <div className="flex items-center gap-2">
            <nav className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm text-sm">
              <button onClick={()=>setTab('input')} className={`px-3 py-1 rounded-lg ${tab==='input'?'bg-[#f4f1e8]':''}`}>Въвеждане</button>
              <button onClick={()=>setTab('analytics')} className={`px-3 py-1 rounded-lg ${tab==='analytics'?'bg-[#eaf7f1]':''}`}>Анализ</button>
            </nav>
            <input type="month" value={monthISO} onChange={(e)=>setMonth(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm"/>
          </div>
        </header>

        {/* СТРАНИЦА 1: Въвеждане */}
        {tab==='input' && (
          <section className="grid gap-3">
            <Card title="Бърз разход">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                <input type="date" value={expDate} onChange={e=>setExpDate(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-1 text-sm" />
                <select value={expCat} onChange={e=>setExpCat(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-1 text-sm">
                  {(categories as string[]).map((c)=> <option key={c}>{c}</option>)}
                </select>
                <input placeholder="Бележка (по желание)" value={expNote} onChange={e=>setExpNote(e.target.value)} className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 px-2 py-1 text-sm" />
                <input type="number" inputMode="decimal" placeholder="Сума" value={expAmount} onChange={e=>setExpAmount(Number(e.target.value))} className="col-span-1 rounded-xl border border-slate-200 px-2 py-1 text-sm" />
                <button onClick={addExpense} className="col-span-1 rounded-xl border border-slate-200 bg-[#f4f1e8] px-3 py-1 text-sm hover:bg-[#eee9dc]">+ Добави</button>
              </div>
            </Card>

            <Card title="Бърз приход">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                <input type="date" value={incDate} onChange={e=>setIncDate(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-1 text-sm" />
                <input placeholder="Етикет" value={incLabel} onChange={e=>setIncLabel(e.target.value)} className="col-span-2 sm:col-span-2 rounded-xl border border-slate-200 px-2 py-1 text-sm" />
                <input type="number" inputMode="decimal" placeholder="Сума" value={incAmount} onChange={e=>setIncAmount(Number(e.target.value))} className="col-span-1 rounded-xl border border-slate-200 px-2 py-1 text-sm" />
                <button onClick={addIncome} className="col-span-1 rounded-xl border border-slate-200 bg-[#eaf7f1] px-3 py-1 text-sm hover:bg-[#ddf1e7]">+ Добави</button>
              </div>
            </Card>
          </section>
        )}

        {/* СТРАНИЦА 2: Анализ */}
        {tab==='analytics' && (
          <section className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Summary label="Приходи (месец)" value={totalInc} />
              <Summary label="Разходи (месец)" value={totalExp} />
              <Summary label="Баланс (месец)" value={balance} tone={balance>=0?"pos":"neg"} />
              <Summary label="Желан доход" value={desiredIncome} hint={`разходи / 80%`}>
                <div className="mt-1 text-[11px] opacity-70">
                  Разлика: <b className={`${desiredDiff>0?'text-rose-600':desiredDiff<0?'text-emerald-600':''}`}>{round2(desiredDiff)} {CURRENCY}</b>
                  {" " + (desiredDiff>0? "(недостига)" : desiredDiff<0? "(излишък)" : "")}
                  <br/>Необходима сума: <b className="text-rose-600">{round2(requiredExtra)} {CURRENCY}</b>
                </div>
              </Summary>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <TinyCard title="Разпределение по 80/10/10">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><div className="opacity-70">Основни</div><div className="font-medium">{round2(sNeeds)} {CURRENCY}</div></div>
                  <div><div className="opacity-70">Сигурност</div><div className="font-medium">{round2(sInvest)} {CURRENCY}</div></div>
                  <div><div className="opacity-70">Удоволствия</div><div className="font-medium">{round2(sFun)} {CURRENCY}</div></div>
                </div>
              </TinyCard>
              <Donut title="Къде отидоха парите (категории)" data={pieData} />
              <TinyCard title="Дългове">
                <div className="grid grid-cols-5 gap-2 items-center mb-2">
                  <input placeholder="Име" value={debtName} onChange={e=>setDebtName(e.target.value)} className="col-span-2 rounded-xl border border-slate-200 px-2 py-1 text-sm"/>
                  <input type="number" inputMode="decimal" placeholder="Сума" value={debtAmount} onChange={e=>setDebtAmount(Number(e.target.value))} className="col-span-2 rounded-xl border border-slate-200 px-2 py-1 text-sm"/>
                  <button onClick={addDebt} className="col-span-1 rounded-xl border border-slate-200 bg-[#f4f1e8] px-3 py-1 text-sm hover:bg-[#eee9dc]">+ Добави</button>
                </div>
                {(!debts || (debts as Debt[]).length===0) ? (
                  <Empty>Няма въведени дългове.</Empty>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {(debts as Debt[]).map((d)=> (
                      <li key={d.id} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={!!d.done} onChange={()=>toggleDebt(d.id)} />
                          <span className={d.done?"line-through opacity-60":""}>{d.name}</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{round2(d.amount)} {CURRENCY}</span>
                          <button onClick={()=>deleteDebt(d.id)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✕</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </TinyCard>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ListCard title="Записи – Разходи (месец)">
                {expMonth.length===0 ? (
                  <Empty>Няма разходи за този месец.</Empty>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs opacity-60">
                        <th className="py-1">Дата</th>
                        <th className="py-1">Категория</th>
                        <th className="py-1">Бележка</th>
                        <th className="py-1 text-right">Сума</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {expMonth.map((e)=> (
                        <tr key={e.id} className="border-t border-slate-100">
                          <td className="py-1">{fmtDateHuman(e.date)}</td>
                          <td className="py-1">{editExpId===e.id ? (
                            <select value={editExpDraft.category} onChange={ev=>setEditExpDraft({...editExpDraft, category: ev.target.value})} className="rounded-lg border border-slate-200 px-2 py-0.5">
                              {(categories as string[]).map((c)=> <option key={c}>{c}</option>)}
                            </select>
                          ) : e.category}</td>
                          <td className="py-1 opacity-80">{editExpId===e.id ? (
                            <input value={editExpDraft.note||''} onChange={ev=>setEditExpDraft({...editExpDraft, note: ev.target.value})} className="rounded-lg border border-slate-200 px-2 py-0.5"/>
                          ) : e.note}</td>
                          <td className="py-1 text-right">
                            <span className="font-medium text-rose-700">{round2(editExpId===e.id? editExpDraft.amount : e.amount)} {CURRENCY}</span>
                          </td>
                          <td className="py-1 text-right">
                            {editExpId===e.id ? (
                              <div className="flex justify-end gap-1">
                                <input type="date" value={editExpDraft.date} onChange={ev=>setEditExpDraft({...editExpDraft, date: ev.target.value})} className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs"/>
                                <input type="number" value={editExpDraft.amount} onChange={ev=>setEditExpDraft({...editExpDraft, amount: Number(ev.target.value)})} className="w-24 rounded-lg border border-slate-200 px-2 py-0.5 text-xs"/>
                                <button onClick={saveEditExp} className="rounded-lg px-2 py-0.5 text-xs ring-1">💾</button>
                                <button onClick={()=>setEditExpId(null)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✖</button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <button onClick={()=>startEditExp(e)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✎</button>
                                <button onClick={()=>deleteExp(e.id)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✕</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ListCard>

              <ListCard title="Записи – Приходи (месец)">
                {incMonth.length===0 ? (
                  <Empty>Няма приходи за този месец.</Empty>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs opacity-60">
                        <th className="py-1">Дата</th>
                        <th className="py-1">Етикет</th>
                        <th className="py-1 text-right">Сума</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {incMonth.map((i)=> (
                        <tr key={i.id} className="border-t border-slate-100">
                          <td className="py-1">{fmtDateHuman(i.date)}</td>
                          <td className="py-1">{editIncId===i.id ? (
                            <input value={editIncDraft.label} onChange={ev=>setEditIncDraft({...editIncDraft, label: ev.target.value})} className="rounded-lg border border-slate-200 px-2 py-0.5"/>
                          ) : i.label}</td>
                          <td className="py-1 text-right">
                            <span className="font-medium text-emerald-700">{round2(editIncId===i.id? editIncDraft.amount : i.amount)} {CURRENCY}</span>
                          </td>
                          <td className="py-1 text-right">
                            {editIncId===i.id ? (
                              <div className="flex justify-end gap-1">
                                <input type="date" value={editIncDraft.date} onChange={ev=>setEditIncDraft({...editIncDraft, date: ev.target.value})} className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs"/>
                                <input type="number" value={editIncDraft.amount} onChange={ev=>setEditIncDraft({...editIncDraft, amount: Number(ev.target.value)})} className="w-24 rounded-lg border border-slate-200 px-2 py-0.5 text-xs"/>
                                <button onClick={saveEditInc} className="rounded-lg px-2 py-0.5 text-xs ring-1">💾</button>
                                <button onClick={()=>setEditIncId(null)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✖</button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <button onClick={()=>startEditInc(i)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✎</button>
                                <button onClick={()=>deleteInc(i.id)} className="rounded-lg px-2 py-0.5 text-xs ring-1">✕</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ListCard>
            </div>

            <div className="flex justify-end">
              <button onClick={exportCSV} className="rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm hover:bg-slate-50">Експорт в Excel (CSV)</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const Card: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="mb-2 text-sm font-medium opacity-80">{title}</div>
    {children}
  </div>
);

const Summary: React.FC<{ label: string; value: number; hint?: string; tone?: 'pos'|'neg'; children?: React.ReactNode }> = ({ label, value, hint, tone, children }) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${tone==='pos'? 'outline outline-1 outline-emerald-100' : tone==='neg'? 'outline outline-1 outline-rose-100' : ''}`}>
    <div className="text-xs opacity-60">{label}</div>
    <div className={`text-lg font-semibold ${tone==='pos'? 'text-emerald-700' : tone==='neg'? 'text-rose-700' : ''}`}>
      {round2(value)} {CURRENCY}
    </div>
    {hint && <div className="text-[11px] opacity-60 mt-1">{hint}</div>}
    {children}
  </div>
);

const TinyCard: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="mb-2 text-sm font-medium opacity-80">{title}</div>
    {children}
  </div>
);

const ListCard: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="mb-2 text-sm font-medium opacity-80">{title}</div>
    <div className="overflow-x-auto">{children}</div>
  </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm opacity-60">{children}</div>
);

const Donut: React.FC<{ title: string; data: { name: string; value: number }[] }> = ({ title, data }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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
