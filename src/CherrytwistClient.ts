import { GraphQLClient } from 'graphql-request';
import { ClientConfig } from './config/ClientConfig';
import {
  Context,
  ContextInput,
  getSdk,
  Opportunity,
  OpportunityInput,
  Sdk,
} from './graphql';
import { Logger } from 'winston';
import { ErrorHandler, handleErrors } from './util/handleErrors';
import { group } from 'console';
import { authenticationWrapper } from './authenticationWrapper';

export class CherrytwistClient {
  private config: ClientConfig;
  private client: Sdk;
  private errorHandler: ErrorHandler;

  constructor(config: ClientConfig) {
    this.config = config;

    const client = new GraphQLClient(config.graphqlEndpoint, {
      headers: {
        authorization: 'Bearer'
      },
    });
    this.client = getSdk(client, authenticationWrapper);

    this.errorHandler = handleErrors();
  }

  public async testConnection(): Promise<Boolean> {
    try {
      const {
        data,
        errors,
        status,
        extensions,
      } = await this.client.ecoverseName();

      var ecoverseName = data?.name;

      if (errors) {
        return false;
      }
      return true;
    } catch (ex) {
      return false;
    }
  }

  private async getChallenge(name: string) {
    const {
      data: challengesData,
      errors: challengesErrors,
    } = await this.client.challenges();

    this.errorHandler(challengesErrors);

    if (!challengesData) return;
    const challenges = challengesData.challenges;

    const challenge = challenges.find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );

    return challenge;
  }

  public async createOpportunity(
    challengeID: number,
    opportunity: OpportunityInput
  ) {
    const result = await this.client.createOpportunity({
      challengeID,
      opportunityData: opportunity,
    });

    this.errorHandler(result.errors);

    return result.data?.createOpportunityOnChallenge;
  }

  public async addReference(
    profileID: string,
    referenceName: string,
    referenceURI: string,
    referenceDesc: string
  ) {
    const { data, errors } = await this.client.createReferenceOnProfile({
      profileID: Number(profileID),
      referenceInput: {
        uri: referenceURI,
        name: referenceName,
        description: referenceDesc,
      },
    });

    this.errorHandler(errors);

    return data?.createReferenceOnProfile;
  }

  public async updateUserProfile(
    userEmail: string,
    description: string,
    avatarURI: string
  ): Promise<Boolean> {
    const { data, errors } = await this.client.user({
      ID: userEmail,
    });

    const profileID = data?.user.profile?.id;

    this.errorHandler(errors);

    if (profileID) {
      return !!(await this.updateProfile(profileID, avatarURI, description));
    }

    return false;
  }

  async updateProfile(
    profileID: string,
    avatarURI?: string,
    description?: string
  ) {
    const ID = Number(profileID);

    const { data, errors } = await this.client.updateProfile({
      ID,
      profileData: {
        avatar: avatarURI,
        description: description,
        tagsetsData: [],
        referencesData: [],
      },
    });
    this.errorHandler(errors);
    return data?.updateProfile;
  }

  async createTagset(
    profileID: string,
    tagsetName: string,
    tags: string[]
  ): Promise<Boolean> {
    if (tags) {
      const { data, errors } = await this.client.createTagsetOnProfile({
        profileID: Number(profileID),
        tagsetName,
      });

      this.errorHandler(errors);

      const newTagsetId = Number(data?.createTagsetOnProfile.id);
      if (!data) return false;

      const {
        data: replaceData,
        errors: replaceErrors,
      } = await this.client.replaceTagsOnTagset({
        tagsetID: newTagsetId,
        tags,
      });

      this.errorHandler(replaceErrors);
    }
    return true;
  }

  async addUserToGroup(userID: string, groupID: string): Promise<Boolean> {
    const uID = Number(userID);
    const gID = Number(groupID);

    const { data, errors } = await this.client.addUserToGroup({
      userID: uID,
      groupID: gID,
    });

    this.errorHandler(errors);

    return !!data?.addUserToGroup;
  }

  async addUserToChallenge(challengeName: string, userID: string) {
    const challenge = await this.getChallenge(challengeName);

    if (!challenge) return;

    const { data, errors } = await this.client.addUserToChallenge({
      userID: Number(userID),
      challengeID: Number(challenge.id),
    });

    this.errorHandler(errors);
    return data?.addUserToChallenge;
  }

  async addChallengeLead(challengeName: string, organisationID: string) {
    const challenge = await this.getChallenge(challengeName);

    if (!challenge) return false;
    const { data, errors } = await this.client.addChallengeLead({
      challengeID: Number(challenge.id),
      organisationID: Number(organisationID),
    });

    return !!data?.addChallengeLead;
  }

  async updateEcoverseContext(context: ContextInput) {
    const { data, errors } = await this.client.updateEcoverse({
      ecoverseData: {
        context: context,
      },
    });

    this.errorHandler(errors);

    return data?.updateEcoverse;
  }

  async addTagToTagset(tagsetID: string, tagName: string) {
    const { data, errors } = await this.client.addTagToTagset({
      tagsetID: Number(tagsetID),
      tag: tagName,
    });

    this.errorHandler(errors);

    return data?.addTagToTagset;
  }

  async createRelation(
    opportunityID: number,
    type: string,
    description: string,
    actorName: string,
    actorRole: string,
    actorType: string
  ) {
    const relationData = {
      type,
      description,
      actorName,
      actorType,
      actorRole,
    };

    const { data, errors } = await this.client.createRelation({
      opportunityID: opportunityID,
      relationData,
    });

    this.errorHandler(errors);

    return data?.createRelation;
  }

  async createActorGroup(
    opportunityID: number,
    actorGroupName: string,
    description: string
  ) {
    const { data, errors } = await this.client.createActorGroup({
      opportunityID: Number(opportunityID),
      actorGroupData: {
        name: actorGroupName,
        description,
      },
    });

    this.errorHandler(errors);

    return data?.createActorGroup;
  }

  // Create a actorgroup for the given opportunity
  async createActor(
    actorGroupID: number,
    actorName: string,
    value?: string,
    impact?: string,
    description = ''
  ): Promise<any> {
    const { data, errors } = await this.client.createActor({
      actorGroupID,
      actorData: {
        name: actorName,
        value,
        impact,
        description,
      },
    });

    this.errorHandler(errors);

    return data?.createActor;
  }

  // Create a actorgroup for the given opportunity
  async updateActor(
    actorID: number,
    actorName: string,
    value: string,
    impact = '',
    description = ''
  ): Promise<any> {
    const { data, errors } = await this.client.updateActor({
      ID: actorID,
      actorData: {
        name: actorName,
        value,
        impact,
        description,
      },
    });

    this.errorHandler(errors);

    return data?.updateActor;
  }

  // Create a aspect for the given opportunity
  async createAspect(
    opportunityID: number,
    title: string,
    framing: string,
    explanation: string
  ) {
    const { data, errors } = await this.client.createAspect({
      opportunityID,
      aspectData: {
        title,
        framing,
        explanation,
      },
    });

    this.errorHandler(errors);

    return data?.createAspect;
  }

  // Create a gouup at the ecoverse level with the given name
  async createEcoverseGroup(groupName: string) {
    const { data, errors } = await this.client.createGroupOnEcoverse({
      groupName,
    });

    this.errorHandler(errors);

    return data?.createGroupOnEcoverse;
  }

  // Load in mutations file
  async updateHostOrganisation(name: string, logoUri?: string) {
    const {
      data: hostInfo,
      errors: hostInfoErrors,
    } = await this.client.hostInfo();
    this.errorHandler(hostInfoErrors);

    if (!hostInfo) return;
    const hostID = hostInfo.host.id;
    const hostProfileID = hostInfo.host.profile.id;

    if (logoUri) {
      await this.addReference(
        hostProfileID,
        'logo',
        logoUri,
        'Logo for the ecoverse host'
      );
    }

    const { data, errors } = await this.client.updateOrganisation({
      orgID: Number(hostID),
      organisationData: {
        name,
      },
    });

    this.errorHandler(errors);
    return data?.updateOrganisation;
  }
}
