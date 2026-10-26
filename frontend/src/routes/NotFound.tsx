/**
 * 404 page — same markup/styles as the default Next.js not-found page the app used
 * (the app had no custom not-found.tsx). Rendered for unknown URLs and by notFound().
 * No <title> here: in the baseline the document title of a 404 stays the root title
 * "مفقود | MFQOD" (Next rendered the 404 <title> after the root one, so it never won).
 */
export default function NotFound() {
  return (
    <>
      <meta name="robots" content="noindex" />
      <div
        style={{
          fontFamily:
            'system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"',
          height: '100vh',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div>
          <style
            dangerouslySetInnerHTML={{
              __html:
                'body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}',
            }}
          />
          <h1
            className="next-error-h1"
            style={{
              display: 'inline-block',
              margin: '0 20px 0 0',
              padding: '0 23px 0 0',
              fontSize: 24,
              fontWeight: 500,
              verticalAlign: 'top',
              lineHeight: '49px',
            }}
          >
            404
          </h1>
          <div style={{ display: 'inline-block' }}>
            <h2 style={{ fontSize: 14, fontWeight: 400, lineHeight: '49px', margin: 0 }}>
              This page could not be found.
            </h2>
          </div>
        </div>
      </div>
    </>
  );
}
