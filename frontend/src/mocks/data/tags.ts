import type { Tag } from "@/types";

/**
 * Maps each available tag to a representative hex color for UI hints.
 * Used in TagSelector and ProfilePage to give visual context.
 */
export const TAG_COLORS: Record<Tag, string> = {
  AWS: "#FF6B35",
  React: "#61DAFB",
  TypeScript: "#3178C6",
  "Node.js": "#68A063",
  Python: "#FFD43B",
  Docker: "#0DB7ED",
  Kubernetes: "#326CE5",
  Linux: "#E95420",
  DynamoDB: "#FF6B35",
  PostgreSQL: "#336791",
  Redis: "#D82C20",
  GraphQL: "#E535AB",
  Rust: "#CE422B",
  Go: "#00ADD8",
  "CI/CD": "#24292F",
  Terraform: "#7B42BC",
  Serverless: "#FD5750",
  Security: "#E74C3C",
  Performance: "#F39C12",
  Architecture: "#2ECC71",
};

/**
 * Simulates the Gemini API tag extraction from a user's profile description.
 * Maps description keywords to matching AVAILABLE_TAGS entries.
 * Always returns at least 3 tags.
 */
export function mockExtractTags(description: string): Tag[] {
  const lower = description.toLowerCase();
  const extracted: Tag[] = [];

  const mappings: Array<[string[], Tag]> = [
    [["aws", "lambda", "ec2", "s3", "cloudwatch", "cognito"], "AWS"],
    [["react", "jsx", "tsx", "next.js", "vite"], "React"],
    [["typescript", " ts ", "strict types", "type-safe"], "TypeScript"],
    [["node", "node.js", "express", "fastify", "bun"], "Node.js"],
    [["python", "django", "fastapi", "flask"], "Python"],
    [["docker", "container", "dockerfile", "compose"], "Docker"],
    [["kubernetes", "k8s", "helm", "kubectl"], "Kubernetes"],
    [["linux", "bash", "shell", "unix"], "Linux"],
    [["dynamodb", "nosql", "single-table"], "DynamoDB"],
    [["postgres", "postgresql", "sql", "relational"], "PostgreSQL"],
    [["redis", "cache", "caching", "memcached"], "Redis"],
    [["graphql", "apollo", "schema", "resolver"], "GraphQL"],
    [["rust", "ownership", "borrow"], "Rust"],
    [["golang", "go lang"], "Go"],
    [["ci/cd", "github actions", "pipeline"], "CI/CD"],
    [["terraform", "infrastructure as code", "iac", "pulumi"], "Terraform"],
    [["serverless", "lambda", "faas", "functions"], "Serverless"],
    [["security", "auth", "jwt", "oauth", "iam"], "Security"],
    [["performance", "optimiz", "latency", "throughput"], "Performance"],
    [
      ["architecture", "design pattern", "microservice", "system design"],
      "Architecture",
    ],
  ];

  for (const [keywords, tag] of mappings) {
    if (keywords.some((kw) => lower.includes(kw)) && !extracted.includes(tag)) {
      extracted.push(tag);
    }
  }

  if (extracted.length === 0)
    return ["Architecture", "Performance", "Security"];

  const first = extracted[0];
  if (extracted.length === 1 && first !== undefined)
    return [first, "Architecture", "Performance"];

  const second = extracted[1];
  if (extracted.length === 2 && first !== undefined && second !== undefined) {
    return [first, second, "Architecture"];
  }

  return extracted.slice(0, 10);
}
