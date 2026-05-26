using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaLibraryTypeInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("parentId")]
	public string? ParentId { get; set; }

	[JsonProperty("namespace")]
	public string? Namespace { get; set; }

	[JsonProperty("author")]
	public string? Author { get; set; }

	[JsonProperty("versionCount")]
	public int VersionCount { get; set; }
}
