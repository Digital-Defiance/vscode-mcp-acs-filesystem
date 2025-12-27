import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import "./Components.css";

interface Feature {
  title: string;
  description: string;
  icon: string;
  tech: string[];
  highlights: string[];
  category: "Core" | "Interfaces" | "Security" | "Errors" | "Builders";
}

const features: Feature[] = [
  {
    title: "Advanced File Operations",
    icon: "📁",
    description:
      "Execute multiple file operations atomically with automatic rollback on failure. Batch copy, move, and delete operations with full transaction support.",
    tech: ["Batch Operations", "Atomic Transactions", "Rollback"],
    category: "Core",
    highlights: [
      "Batch copy, move, and delete operations",
      "Atomic execution with automatic rollback",
      "Directory copying with exclusion patterns",
      "Preserve metadata and permissions",
      "Progress tracking for large operations",
    ],
  },
  {
    title: "10-Layer Security",
    icon: "🔒",
    description:
      "Enterprise-grade security with workspace jail, path validation, hardcoded blocklists, rate limiting, and complete audit logging. AI agents operate within strict boundaries.",
    tech: ["Security", "Path Validation", "Audit Logging"],
    category: "Security",
    highlights: [
      "Workspace jail - operations confined to workspace root",
      "10-layer path validation prevents traversal attacks",
      "Hardcoded blocklists for system paths and sensitive files",
      "Rate limiting prevents abuse",
      "Complete audit logging for forensics",
    ],
  },
  {
    title: "Directory Watching",
    icon: "👁️",
    description:
      "Monitor directories for real-time file system changes. Recursive watching with event filtering and pattern-based file filtering.",
    tech: ["File Watching", "Event Filtering", "Real-time"],
    category: "Core",
    highlights: [
      "Recursive directory monitoring",
      "Event type filtering (create, modify, delete, rename)",
      "Pattern-based file filtering",
      "Accumulated event retrieval",
      "Directory synchronization support",
    ],
  },
  {
    title: "File Search & Indexing",
    icon: "🔍",
    description:
      "Fast file search with multiple modes: filename pattern matching, full-text content search, and metadata filtering. Indexed search for large codebases.",
    tech: ["Search", "Indexing", "Full-text"],
    category: "Core",
    highlights: [
      "Filename pattern matching with glob support",
      "Content search (full-text)",
      "Metadata filtering (size, date, type)",
      "Indexed search for performance",
      "Search results with file context",
    ],
  },
  {
    title: "Checksum & Verification",
    icon: "✓",
    description:
      "Verify file integrity with multiple hash algorithms. Compute and validate checksums with MD5, SHA-1, SHA-256, and SHA-512.",
    tech: ["Cryptography", "Hashing", "Verification"],
    category: "Security",
    highlights: [
      "MD5, SHA-1, SHA-256, SHA-512 algorithms",
      "Batch checksum computation",
      "Checksum verification and comparison",
      "File integrity monitoring",
      "Tamper detection support",
    ],
  },
  {
    title: "Disk Usage Analysis",
    icon: "📊",
    description:
      "Analyze storage usage with recursive directory size calculation, largest files identification, and file type breakdown.",
    tech: ["Analysis", "Storage", "Reporting"],
    category: "Core",
    highlights: [
      "Recursive directory size calculation",
      "Identify largest files and directories",
      "File type breakdown and statistics",
      "Available disk space queries",
      "Grouping by file type for analysis",
    ],
  },
  {
    title: "AI Integration",
    icon: "🤖",
    description:
      "Seamless integration with GitHub Copilot and AI agents through MCP Protocol. Use @filesystem in Copilot chat for natural language file operations.",
    tech: ["MCP Protocol", "Copilot", "AI Agents"],
    category: "Interfaces",
    highlights: [
      "Copilot Chat Participant: @filesystem",
      "Language Model Tools for direct AI access",
      "MCP Protocol integration",
      "Security boundaries for AI operations",
      "Natural language file operations",
    ],
  },
  {
    title: "Language Server Protocol",
    icon: "🎨",
    description:
      "Intelligent code completion, hover information, and diagnostics for filesystem operations. LSP features enhance developer experience.",
    tech: ["LSP", "Code Intelligence", "Diagnostics"],
    category: "Interfaces",
    highlights: [
      "Hover over paths for file metadata",
      "Intelligent path completion suggestions",
      "Real-time diagnostics for security violations",
      "Quick fixes for common issues",
      "Convert to workspace-relative paths",
    ],
  },
];

const Components = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return (
    <section className="components section" id="components" ref={ref}>
      <motion.div
        className="components-container"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
      >
        <h2 className="section-title">
          Core <span className="gradient-text">Features</span> & Capabilities
        </h2>
        <p className="components-subtitle">
          Advanced filesystem operations with enterprise-grade security for AI agents
        </p>

        <motion.div
          className="suite-intro"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h3>
            Secure <em>filesystem operations</em> for <em>AI agents</em> with strict <em>security boundaries</em>
          </h3>
          <p>
            <strong>
              MCP ACS Filesystem Manager brings enterprise-grade file operations to AI agents
            </strong>{" "}
            with comprehensive security controls. Execute batch operations atomically,
            monitor directories in real-time, search files by name or content, and analyze
            disk usage - all within strict workspace boundaries that keep your sensitive
            data safe.
          </p>
          <div className="problem-solution">
            <div className="problem">
              <h4>❌ The Challenge: AI Agents Need Safe Filesystem Access</h4>
              <ul>
                <li>Preventing path traversal and directory escape attacks</li>
                <li>Protecting sensitive files and system directories</li>
                <li>Rate limiting to prevent abuse and resource exhaustion</li>
                <li>Atomic operations with rollback on failure</li>
                <li>Real-time monitoring and audit logging</li>
              </ul>
              <p>
                <strong>Result:</strong> AI agents either can't access files or have unsafe unlimited access.
              </p>
            </div>
            <div className="solution">
              <h4>✅ The Solution: 10-Layer Security with Advanced Operations</h4>
              <p>
                <strong>MCP ACS Filesystem Manager</strong> provides{" "}
                <strong>workspace jail</strong> that confines all operations to your workspace,
                <strong> 10-layer path validation</strong> to prevent traversal attacks,
                <strong> hardcoded blocklists</strong> for system paths and sensitive files,
                and <strong>complete audit logging</strong> for forensics.
              </p>
              <p>
                Built on <strong>Model Context Protocol</strong> with seamless{" "}
                <strong>GitHub Copilot integration</strong>, it enables AI agents to
                perform complex file operations safely. Use natural language commands
                like <code>@filesystem batch copy all TypeScript files</code> or{" "}
                <code>@filesystem search for TODO comments</code>.
              </p>
            </div>
          </div>
          <div className="value-props">
            <div className="value-prop">
              <strong>🔒 10-Layer Security</strong>
              <p>
                Workspace jail, path validation, blocklists, rate limiting, and
                complete audit logging
              </p>
            </div>
            <div className="value-prop">
              <strong>📁 Batch Operations</strong>
              <p>
                Atomic copy, move, and delete operations with automatic rollback
                on failure
              </p>
            </div>
            <div className="value-prop">
              <strong>👁️ Directory Watching</strong>
              <p>
                Real-time monitoring with event filtering and pattern-based
                file filtering
              </p>
            </div>
            <div className="value-prop">
              <strong>🤖 AI Integration</strong>
              <p>
                GitHub Copilot chat participant with natural language commands
                and MCP protocol support
              </p>
            </div>
          </div>
        </motion.div>

        <div className="components-grid">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="component-card card"
              initial={{ opacity: 0, y: 50 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: index * 0.1, duration: 0.6 }}
            >
              <div className="component-header">
                <div className="component-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <span
                  className={`component-badge ${feature.category.toLowerCase()}`}
                >
                  {feature.category}
                </span>
              </div>

              <p className="component-description">{feature.description}</p>

              <ul className="component-highlights">
                {feature.highlights.map((highlight, i) => (
                  <li key={i}>{highlight}</li>
                ))}
              </ul>

              <div className="component-tech">
                {feature.tech.map((tech) => (
                  <span key={tech} className="tech-badge">
                    {tech}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default Components;
