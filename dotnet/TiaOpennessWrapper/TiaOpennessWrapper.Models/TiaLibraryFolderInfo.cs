using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaLibraryFolderInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("parentId")]
	public string? ParentId { get; set; }

	[JsonProperty("folders")]
	public List<TiaLibraryFolderInfo> Folders { get; set; } = new List<TiaLibraryFolderInfo>();

	[JsonProperty("masterCopies")]
	public List<TiaMasterCopyInfo> MasterCopies { get; set; } = new List<TiaMasterCopyInfo>();
}
