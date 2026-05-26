using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaWatchTableInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";
}
