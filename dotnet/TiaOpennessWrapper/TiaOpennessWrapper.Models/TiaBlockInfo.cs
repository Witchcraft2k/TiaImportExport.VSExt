using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaBlockInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("number")]
	public int Number { get; set; }

	[JsonProperty("type")]
	public string Type { get; set; } = "";

	[JsonProperty("language")]
	public string? Language { get; set; }

	[JsonProperty("title")]
	public string? Title { get; set; }

	[JsonProperty("author")]
	public string? Author { get; set; }

	[JsonProperty("version")]
	public string? Version { get; set; }

	[JsonProperty("isSystem")]
	public bool IsSystem { get; set; }

	[JsonProperty("isKnowHowProtected")]
	public bool IsKnowHowProtected { get; set; }

	[JsonProperty("groupId")]
	public string? GroupId { get; set; }

	[JsonProperty("instanceOfFb")]
	public string? InstanceOfFb { get; set; }
}
