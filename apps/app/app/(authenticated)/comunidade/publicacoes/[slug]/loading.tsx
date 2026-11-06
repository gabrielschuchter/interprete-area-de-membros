const CommunityPostLoading = () => (
  <div aria-busy="true" className="cp-page" data-route-loading>
    <main>
      <header className="cp-hero" data-cover="true" data-state="loading">
        <div className="cp-hero__inner">
          <div className="cp-sk cp-sk--back" />
          <div className="cp-sk-lines">
            <div className="cp-sk cp-sk--title" />
            <div className="cp-sk cp-sk--title cp-sk--short" />
          </div>
          <div className="cp-sk cp-sk--subtitle" />
          <div className="cp-sk-author">
            <div className="cp-sk cp-sk--avatar" />
            <div className="cp-sk cp-sk--name" />
            <div className="cp-sk cp-sk--date" />
          </div>
        </div>
      </header>
      <div className="cp-cover">
        <div className="cp-cover__image cp-sk--cover" />
      </div>
      <div className="cp-column cp-sk-body">
        <div className="cp-sk cp-sk--line" />
        <div className="cp-sk cp-sk--line cp-sk--l2" />
        <div className="cp-sk cp-sk--line" />
        <div className="cp-sk cp-sk--line cp-sk--l4" />
      </div>
    </main>
  </div>
);

export default CommunityPostLoading;
