import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { RefreshCw, Printer, Search, X, CheckSquare } from 'lucide-react';
import { imprimirOrdenes } from '../lib/pdf';

const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '-';
const fmt = n => n ? `$${Number(n).toLocaleString('es-CO')}` : '-';
const ESTADOS = ['Recibido','En producción','Despachado','Entregado','Cancelado'];
const ESTADO_BADGE = { 'Recibido':'badge-gray','En producción':'badge-amber','Despachado':'badge-blue','Entregado':'badge-green','Cancelado':'badge-red' };

export default function Despacho() {
  const [pedidos, setPedidos] = useState([]);
  const [items, setItems] = useState({});
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [config, setConfig] = useState({});
  const [sel, setSel] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const { toast, ToastContainer } = useToast();

  const [q, setQ] = useState('');
  const [fFecha, setFFecha] = useState('');
  const [fDom, setFDom] = useState('');
  const [fEstado, setFEstado] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: peds }, { data: doms }, { data: cfg }] = await Promise.all([
      supabase.from('pedidos').select('*, domiciliarios(nombre)').order('fecha_entrega').order('hora_entrega'),
      supabase.from('domiciliarios').select('*').eq('activo', true).order('nombre'),
      supabase.from('configuracion').select('*').limit(1).single(),
    ]);
    setPedidos(peds || []);
    setDomiciliarios(doms || []);
    setConfig(cfg || {});
    if (peds?.length) {
      const { data: it } = await supabase.from('pedido_items').select('*').in('pedido_id', peds.map(p=>p.id));
      const map = {};
      (it||[]).forEach(i => { if (!map[i.pedido_id]) map[i.pedido_id] = []; map[i.pedido_id].push(i); });
      setItems(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = pedidos.filter(p => {
    const sq = q.toLowerCase();
    if (sq && !p.nombre_empresa?.toLowerCase().includes(sq) && !String(p.consecutivo).includes(sq)) return false;
    if (fFecha && p.fecha_entrega !== fFecha) return false;
    if (fDom && p.domiciliario_id !== fDom) return false;
    if (fEstado && p.estado !== fEstado) return false;
    return true;
  });

  const selPedidos = filtered.filter(p => sel.has(p.id));
  const toggleAll = () => sel.size === filtered.length ? setSel(new Set()) : setSel(new Set(filtered.map(p=>p.id)));
  const toggleSel = id => setSel(s => { const ns=new Set(s); ns.has(id)?ns.delete(id):ns.add(id); return ns; });

  const asignarMensajero = async (pedidoId, domId) => {
    await supabase.from('pedidos').update({ domiciliario_id: domId||null }).eq('id', pedidoId);
    fetchAll();
  };

  const marcarDespachado = async () => {
    if (!selPedidos.length) { toast('Selecciona pedidos primero', 'error'); return; }
    await supabase.from('pedidos').update({ estado: 'Despachado' }).in('id', [...sel]);
    toast(`✅ ${selPedidos.length} pedidos marcados como Despachado`);
    setSel(new Set());
    fetchAll();
  };

  const imprimir = () => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay pedidos para imprimir', 'error'); return; }
    const enriquecidos = peds.map(p => ({ ...p, domiciliarios: domiciliarios.find(d=>d.id===p.domiciliario_id) || p.domiciliarios }));
    imprimirOrdenes(enriquecidos, items, config);
    toast(`✅ ${peds.length} orden(es) generadas`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Despacho</div>
          <div className="page-sub">{filtered.length} pedidos · {sel.size} seleccionados</div>
        </div>
        <div className="actions-row">
          <button className="btn" onClick={fetchAll}><RefreshCw size={13} /></button>
          {selPedidos.length > 0 && <>
            <button className="btn" onClick={marcarDespachado}><CheckSquare size={13} /> Marcar despachado ({sel.size})</button>
            <button className="btn btn-green" onClick={imprimir}><Printer size={13} /> Imprimir órdenes ({sel.size})</button>
          </>}
          {selPedidos.length === 0 && <button className="btn btn-green" onClick={imprimir}><Printer size={13} /> Imprimir todas</button>}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <Search className="search-icon" />
          <input placeholder="Buscar empresa, # pedido..." value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div>
          <label style={{fontSize:10,color:'#9aa0a6',display:'block',marginBottom:2}}>Fecha de entrega</label>
          <input type="date" value={fFecha} onChange={e=>setFFecha(e.target.value)} />
        </div>
        <select value={fDom} onChange={e=>setFDom(e.target.value)}>
          <option value="">Mensajero (todos)</option>
          {domiciliarios.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select value={fEstado} onChange={e=>setFEstado(e.target.value)}>
          <option value="">Estado (todos)</option>
          {ESTADOS.map(s=><option key={s}>{s}</option>)}
        </select>
        {(q||fDom||fEstado||fFecha) && <button className="btn btn-ghost" onClick={()=>{setQ('');setFDom('');setFEstado('');setFFecha('');}}><X size={13} /></button>}
      </div>

      {loading ? <div className="empty">Cargando…</div> :
       filtered.length === 0 ? <div className="empty">No hay pedidos con estos filtros.</div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{width:36}}><input type="checkbox" checked={sel.size===filtered.length&&filtered.length>0} onChange={toggleAll} /></th>
                <th>#</th>
                <th>Empresa</th>
                <th>Dirección</th>
                <th>Productos</th>
                <th>F. Entrega</th>
                <th>Hora</th>
                <th>Total</th>
                <th>Mensajero</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const pit = items[p.id] || [];
                const total = pit.reduce((s,i)=>s+(i.subtotal||0),0);
                return (
                  <tr key={p.id} style={sel.has(p.id)?{background:'#f0fdf4'}:{}}>
                    <td><input type="checkbox" checked={sel.has(p.id)} onChange={()=>toggleSel(p.id)} /></td>
                    <td><span className="td-mono">{String(p.consecutivo).padStart(4,'0')}</span></td>
                    <td>
                      <div className="td-bold">{p.nombre_empresa}</div>
                      <div style={{fontSize:11,color:'#9aa0a6'}}>{p.telefono}</div>
                    </td>
                    <td style={{fontSize:12,maxWidth:160}}>{p.direccion}</td>
                    <td style={{minWidth:160}}>
                      {pit.map(i=>(
                        <div key={i.id} style={{display:'flex',alignItems:'center',gap:4,marginBottom:2}}>
                          <span style={{background:'#e6f4ea',color:'#1a5c2a',borderRadius:3,padding:'1px 5px',fontSize:11,fontWeight:600}}>{i.cantidad}</span>
                          <span style={{fontSize:12}}>{i.nombre_producto}</span>
                        </div>
                      ))}
                    </td>
                    <td>{fmtDate(p.fecha_entrega)}</td>
                    <td>{p.hora_entrega?p.hora_entrega.slice(0,5):'-'}</td>
                    <td className="td-right td-bold">{fmt(total)}</td>
                    <td>
                      <select value={p.domiciliario_id||''} onChange={e=>asignarMensajero(p.id,e.target.value)} style={{padding:'4px 8px',border:'1px solid #dadce0',borderRadius:4,fontSize:12,color:'#3c4043',cursor:'pointer',minWidth:100}}>
                        <option value="">— sin asignar —</option>
                        {domiciliarios.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </td>
                    <td><span className={`badge ${ESTADO_BADGE[p.estado]||'badge-gray'}`}>{p.estado}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}
