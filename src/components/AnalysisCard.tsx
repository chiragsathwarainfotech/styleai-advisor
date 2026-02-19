import ReactMarkdown from "react-markdown";

interface AnalysisSection {
  title: string;
  content: string;
}

interface AnalysisCardProps {
  analysisText: string;
}

const sectionIcons: Record<string, string> = {
  "Welcome": "👋",
  "Overall Style Analysis": "👗",
  "Compatibility Check": "🔗",
  "Colour & Style Rules": "🎨",
  "Color & Style Rules": "🎨",
  "Accessory-by-Accessory Verdict": "✅",
  "Best Accessory Recommendation": "💎",
  "Optional Upgrades": "✨",
  "Final Verdict": "⭐",
};

function getIconForSection(title: string): string {
  // Check for exact match first
  if (sectionIcons[title]) return sectionIcons[title];
  
  // Check for partial matches
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("style analysis") || lowerTitle.includes("overall")) return "👗";
  if (lowerTitle.includes("compatibility")) return "🔗";
  if (lowerTitle.includes("colour") || lowerTitle.includes("color")) return "🎨";
  if (lowerTitle.includes("accessory") && lowerTitle.includes("verdict")) return "✅";
  if (lowerTitle.includes("recommendation") || lowerTitle.includes("accessory")) return "💎";
  if (lowerTitle.includes("upgrade")) return "✨";
  if (lowerTitle.includes("verdict") || lowerTitle.includes("final")) return "⭐";
  if (lowerTitle.includes("welcome") || lowerTitle.includes("hello") || lowerTitle.includes("hi")) return "👋";
  
  return "📌";
}

function parseAnalysisIntoSections(text: string): AnalysisSection[] {
  const sections: AnalysisSection[] = [];
  
  const lines = text.split('\n');
  let currentTitle = "";
  let currentContent: string[] = [];
  let introContent: string[] = [];
  let foundFirstSection = false;

  for (const line of lines) {
    // Check for bold headers like **Overall Style Analysis**
    const boldMatch = line.match(/^\*\*(.+?)\*\*\s*$/);
    // Check for ### or ## headers
    const hashMatch = line.match(/^#{2,3}\s+(.+)$/);
    
    const headerMatch = boldMatch || hashMatch;
    
    if (headerMatch) {
      // Save previous section
      if (currentTitle && currentContent.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n').trim(),
        });
      } else if (!foundFirstSection && introContent.length > 0) {
        // Save intro content as first section
        sections.push({
          title: "Welcome",
          content: introContent.join('\n').trim(),
        });
      }
      
      foundFirstSection = true;
      currentTitle = headerMatch[1].trim();
      currentContent = [];
    } else if (foundFirstSection) {
      currentContent.push(line);
    } else {
      introContent.push(line);
    }
  }

  // Push the last section
  if (currentTitle && currentContent.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n').trim(),
    });
  }

  // If no sections found, return the whole text as one section
  if (sections.length === 0) {
    return [{
      title: "Style Analysis",
      content: text,
    }];
  }

  return sections;
}

export function AnalysisCard({ analysisText }: AnalysisCardProps) {
  const sections = parseAnalysisIntoSections(analysisText);

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div
          key={index}
          className="bg-card/60 backdrop-blur-sm rounded-xl p-5 border border-border/40 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl">
              {getIconForSection(section.title)}
            </span>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {section.title}
            </h3>
          </div>
          <div className="prose prose-sm max-w-none text-foreground/85 font-body leading-relaxed">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="text-foreground/85 leading-relaxed mb-2 last:mb-0">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-primary">{children}</strong>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 mt-2 text-foreground/85">
                    {children}
                  </ul>
                ),
                li: ({ children }) => (
                  <li className="text-foreground/85">{children}</li>
                ),
              }}
            >
              {section.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
