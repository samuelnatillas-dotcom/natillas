import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { RefreshCw, Printer, Search, X } from 'lucide-react';
import { imprimirComandas } from '../lib/pdf';

const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '-';
const ESTADOS = ['Recibido','En producción','Despachado','Entregado','Cancelado'];
const ESTADO_BADGE = { 'Recibido':'badge-gray','En producción':'badge-amber','Despachado':'badge-blue','Entregado':'badge-green','Cancelado':'badge-red' };

export default function Produccion() {
  const [pedidos, setPedidos] = useState([]);
  const [items, setItems] = useState({});
  const [config, setConfig] = useState({});
  const [sel, setSel] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const { toast, ToastContainer } = useToast();

  const [q, setQ] = useState('');
  const [fFecha, setFFecha] = useState('');
  const [fEstado, setFEstado] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: peds }, { data: cfg }] = await Promise.all([
      supabase.from('pedidos').select('*, domiciliarios(nombre)').order('fecha_entrega').order('hora_entrega'),
      supabase.from('configuracion').select('*').limit(1).single(),
    ]);
    setPedidos(peds || []);
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
    if (fEstado && p.estado !== fEstado) return false;
    return true;
  });

  const totalUnd = filtered.reduce((s,p) => s + (items[p.id]||[]).reduce((ss,i)=>ss+i.cantidad,0), 0);
  const selPedidos = filtered.filter(p => sel.has(p.id));

  const toggleAll = () => sel.size === filtered.length ? setSel(new Set()) : setSel(new Set(filtered.map(p=>p.id)));
  const toggleSel = id => setSel(s => { const ns=new Set(s); ns.has(id)?ns.delete(id):ns.add(id); return ns; });

  const imprimir = () => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay pedidos para imprimir', 'error'); return; }
    imprimirComandas(peds, items, config);
    toast(`✅ ${peds.length} comanda(s) generadas`);
  };

  const cambiarEstado = async (id, estado) => {
    await supabase.from('pedidos').update({ estado }).eq('id', id);
    fetchAll();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Producción</div>
          <div className="page-sub">{filtered.length} pedidos · {totalUnd} unidades totales</div>
        </div>
        <div className="actions-row">
          <button className="btn" onClick={fetchAll}><RefreshCw size={13} /></button>
          <button className="btn btn-green" onClick={imprimir}>
            <Printer size={13} /> {selPedidos.length ? `Imprimir (${selPedidos.length})` : 'Imprimir todas'}
          </button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-label">Pedidos</div><div className="stat-val">{filtered.length}</div></div>
        <div className="stat"><div className="stat-label">Unidades totales</div><div className="stat-val">{totalUnd}</div></div>
        <div className="stat"><div className="stat-label">Seleccionados</div><div className="stat-val">{sel.size}</div></div>
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
        <select value={fEstado} onChange={e=>setFEstado(e.target.value)}>
          <option value="">Estado (todos)</option>
          {ESTADOS.map(s=><option key={s}>{s}</option>)}
        </select>
        {(q||fEstado) && <button className="btn btn-ghost" onClick={()=>{setQ('');setFEstado('');}}><X size={13} /></button>}
      </div>

      {loading ? <div className="empty">Cargando…</div> :
       filtered.length === 0 ? <div className="empty">No hay pedidos para esta fecha.</div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{width:36}}><input type="checkbox" checked={sel.size===filtered.length&&filtered.length>0} onChange={toggleAll} /></th>
                <th>#</th>
                <th>Empresa</th>
                <th>Productos a producir</th>
                <th>Observaciones</th>
                <th>F. Entrega</th>
                <th>Hora</th>
                <th>Estado</th>
                <th>Cambiar estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const pit = items[p.id] || [];
                return (
                  <tr key={p.id} style={sel.has(p.id)?{background:'#f0fdf4'}:{}}>
                    <td><input type="checkbox" checked={sel.has(p.id)} onChange={()=>toggleSel(p.id)} /></td>
                    <td><span className="td-mono">{String(p.consecutivo).padStart(4,'0')}</span></td>
                    <td><div className="td-bold">{p.nombre_empresa}</div><div style={{fontSize:11,color:'#9aa0a6'}}>{p.nombre_contacto}</div></td>
                    <td style={{minWidth:180}}>
                      {pit.map(i=>(
                        <div key={i.id} style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                          <span style={{background:'#e6f4ea',color:'#1a5c2a',borderRadius:3,padding:'1px 6px',fontSize:11,fontWeight:600,minWidth:28,textAlign:'center'}}>{i.cantidad}</span>
                          <span style={{fontSize:12}}>{i.nombre_producto}</span>
                        </div>
                      ))}
                    </td>
                    <td style={{fontSize:11,color:'#5f6368',maxWidth:150,fontStyle:p.observaciones?'italic':'normal'}}>{p.observaciones||'-'}</td>
                    <td>{fmtDate(p.fecha_entrega)}</td>
                    <td>{p.hora_entrega?p.hora_entrega.slice(0,5):'-'}</td>
                    <td><span className={`badge ${ESTADO_BADGE[p.estado]||'badge-gray'}`}>{p.estado}</span></td>
                    <td>
                      <select value={p.estado} onChange={e=>cambiarEstado(p.id,e.target.value)} style={{padding:'4px 8px',border:'1px solid #dadce0',borderRadius:4,fontSize:12,color:'#3c4043',cursor:'pointer'}}>
                        {ESTADOS.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
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
