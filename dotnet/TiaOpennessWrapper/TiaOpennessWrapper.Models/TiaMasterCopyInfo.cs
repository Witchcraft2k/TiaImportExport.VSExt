using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaMasterCopyInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("parentId")]
	public string? ParentId { get; set; }

	[JsonProperty("author")]
	public string? Author { get; set; }

	[JsonProperty("kind")]
	public string Kind { get; set; } = "Unknown";

	[JsonProperty("contentTypes")]
	public List<string> ContentTypes { get; set; } = new List<string>();
}
