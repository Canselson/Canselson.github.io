export default function AboutPage() {
  return (
    <div className="pt-24 pb-24 max-w-3xl mx-auto px-4">

      {/* Header */}
      <div className="mb-12">
        <p className="text-[#641e31] text-xs font-black uppercase tracking-[0.3em] mb-2">
          Southampton Spitfires
        </p>
        <h1 className="text-white text-4xl sm:text-5xl font-black uppercase tracking-tight">
          About Us
        </h1>
      </div>

      {/* History text */}
      <div className="flex flex-col gap-6 text-white/70 text-base leading-relaxed">
        <p>
          In 1997, a small but imaginative group of young engineering students were found lounging
          around after a night at Jesters unmotivated by the prospect of studying, urgently needed
          something new and exciting to get them through the week.
        </p>
        <p>
          They went on to form what would become the Southampton Spitfires Inline &amp; Ice Hockey
          Club. Starting with makeshift roller hockey sessions at Mayflower Park, they soon entered
          competitive leagues, including the BRHA and GBInline, achieving growing success. In 2004,
          they won their first British University Inline National Championship, marking their rise in
          the sport.
        </p>
        <p>
          The club's Ice Hockey journey began in 2005, when they claimed the BUIHA Division 2 title
          and went on to dominate Tier 1 Checking Nationals, with multiple championships including
          victories in 2011, 2014, 2015, and 2017. Now one of the most successful teams in the
          history of Tier 1 University Ice Hockey Nationals, the Spitfires have fostered countless
          memories, relationships, and even future generations of players.
        </p>
        <p>
          With over a hundred male and female members from multiple different local universities, the
          Spitfires have claimed numerous National Championship titles in both ice and inline hockey
          across all different tiers, and have helped countless new players develop, from their first
          steps on the ice to playing on competitive teams, often continuing beyond their time at
          university.
        </p>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 my-12" />

      {/* Club trailer */}
      <div>
        <p className="text-white/40 text-xs font-black uppercase tracking-widest mb-5">
          Club Trailer
        </p>
        <div className="rounded-xl overflow-hidden aspect-video bg-[#111827] border border-white/10">
          <iframe
            src="https://www.youtube.com/embed/kaHpcFzgqv0"
            title="Southampton Spitfires Club Trailer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </div>

    </div>
  )
}
