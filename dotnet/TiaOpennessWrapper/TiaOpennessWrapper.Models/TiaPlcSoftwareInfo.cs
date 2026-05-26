using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaPlcSoftwareInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("language")]
	public string? Language { get; set; }

	[JsonProperty("blockGroups")]
	public List<TiaBlockGroupInfo> BlockGroups { get; set; } = new List<TiaBlockGroupInfo>();

	[JsonProperty("tagTableGroups")]
	public List<TiaTagTableGroupInfo> TagTableGroups { get; set; } = new List<TiaTagTableGroupInfo>();

	[JsonProperty("udtGroups")]
	public List<TiaUdtGroupInfo> UdtGroups { get; set; } = new List<TiaUdtGroupInfo>();

	[JsonProperty("watchTableGroups")]
	public List<TiaWatchTableGroupInfo> WatchTableGroups { get; set; } = new List<TiaWatchTableGroupInfo>();

	[JsonProperty("tagTables")]
	public List<TiaTagTableInfo> TagTables { get; set; } = new List<TiaTagTableInfo>();

	[JsonProperty("userDataTypes")]
	public List<TiaUdtInfo> UserDataTypes { get; set; } = new List<TiaUdtInfo>();

	[JsonProperty("technologyObjects")]
	public List<TiaTechnologyObjectInfo> TechnologyObjects { get; set; } = new List<TiaTechnologyObjectInfo>();

	[JsonProperty("watchTables")]
	public List<TiaWatchTableInfo> WatchTables { get; set; } = new List<TiaWatchTableInfo>();
}
