using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaWatchTableGroupInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("watchTables")]
	public List<TiaWatchTableInfo> WatchTables { get; set; } = new List<TiaWatchTableInfo>();

	[JsonProperty("subGroups")]
	public List<TiaWatchTableGroupInfo> SubGroups { get; set; } = new List<TiaWatchTableGroupInfo>();
}
