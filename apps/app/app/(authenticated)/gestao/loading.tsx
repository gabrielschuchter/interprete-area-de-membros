const GestaoLoading = () => (
  <output aria-busy="true" aria-live="polite" className="gestao-loading">
    <p>Verificando seu acesso…</p>
    <div aria-hidden="true" className="gestao-loading-lines">
      <span />
      <span />
      <span />
    </div>
  </output>
);

export default GestaoLoading;
